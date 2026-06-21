import Types "types/messages";
import MessagesMixin "mixins/messages-api";
import List "mo:core/List";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import MessagesLib "lib/messages";
import Char "mo:core/Char";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";



actor {
  let messages = List.empty<Types.Message>();

  // Nomad Browse state
  var browseRequestId : Nat = 0;
  var lastBrowsePending : Bool = false;
  var lastBrowseNodeHash : Text = "";
  var lastBrowsePagePath : Text = "";
  var lastPageContent : Text = "";
  var lastPageReady : Bool = false;

  // Message ID counter
  var nextMessageId : Nat = 0;

  // Reply state — list of all outbound replies keyed by reply_id
  let replies = List.empty<Types.Reply>();
  var nextReplyId : Nat = 0;

  // Legacy stable vars from previous single-reply model — kept for upgrade compatibility, not used.
  stable var replyId : Nat = 0;
  stable var replyTo : Text = "";
  stable var replyContent : Text = "";
  stable var replyMessageId : Nat = 0;
  stable var replyPending : Bool = false;
  stable var replyStatus : Text = "";
  stable var replyStatusId : Nat = 0;
  stable var replyStatusTimestamp : Text = "";
  stable var replyStatusError : Text = "";

  include MessagesMixin(messages);

  // --- Message cleanup (14-day TTL) ---
  let maxAgeNs : Int = 14 * 24 * 3600 * 1_000_000_000;
  let intervalNs : Int = 24 * 3600 * 1_000_000_000;

  func cleanupOldMessages() {
    let cutoff = Time.now() - maxAgeNs;
    messages.retain(func(m : Types.Message) : Bool { m.timestamp >= cutoff });
  };

  // Fires on first deployment and reschedules itself every 24 hours.
  system func timer(setGlobalTimer : Nat64 -> ()) : async () {
    cleanupOldMessages();
    let nextFire = Time.now() + intervalNs;
    setGlobalTimer(Nat64.fromNat(nextFire.toNat()));
  };

  // --- HTTP types ---
  type HeaderField = (Text, Text);
  type HttpRequest = {
    method : Text;
    url : Text;
    headers : [HeaderField];
    body : Blob;
    certificate_version : ?Nat16;
  };
  type HttpResponse = {
    status_code : Nat16;
    headers : [HeaderField];
    body : Blob;
    upgrade : ?Bool;
  };

  // --- JSON helpers ---
  func jsonResponse(status : Nat16, body : Text) : HttpResponse {
    {
      status_code = status;
      headers = [("Content-Type", "application/json")];
      body = body.encodeUtf8();
      upgrade = null;
    };
  };

  // Serialize messages array to JSON.
  func messagesToJson(msgs : [Types.Message]) : Text {
    var result = "[";
    var first = true;
    for (msg in msgs.values()) {
      if (not first) { result #= "," };
      first := false;
      result #= "{\"id\":";
      result #= msg.id.toText();
      result #= ",\"sender\":\"";
      result #= escapeJson(msg.sender);
      result #= "\",\"content\":\"";
      result #= escapeJson(msg.content);
      result #= "\",\"timestamp\":";
      result #= msg.timestamp.toText();
      result #= "}";
    };
    result #= "]";
    result;
  };

  // Maximum content size stored from bridge (8 KB) to avoid cycle exhaustion.
  let maxContentSize : Nat = 8192;

  // Truncate text to at most `limit` characters efficiently using iterator take.
  func truncate(s : Text, limit : Nat) : Text {
    if (s.size() <= limit) { s } else {
      Text.fromIter(s.toIter().take(limit))
    }
  };

  // JSON string escaping — handles all standard JSON escape sequences.
  // Uses bulk text replacements (backslash first to avoid double-escaping).
  func escapeJson(s : Text) : Text {
    // Truncate oversized content before escaping to cap cycle cost
    let safe = truncate(s, maxContentSize);
    // Backslash first, then the rest
    let r0 = safe.replace(    #char '\\', "\\\\");
    let r1 = r0.replace(      #char '\u{22}', "\\\"");
    let r2 = r1.replace(      #char '\n', "\\n");
    let r3 = r2.replace(      #char '\r', "\\r");
    let r4 = r3.replace(      #char '\t', "\\t");
    r4;
  };

  // Extract the string value of a JSON key from a flat JSON object.
  // Handles: "key":"value" and "key": "value" (with optional space).
  // Properly interprets JSON escape sequences. Returns null on any parse error.
  func jsonGetString(json : Text, key : Text) : ?Text {
    let needle = "\"" # key # "\"";
    if (not json.contains(#text needle)) return null;

    let chars = json.toArray();
    let len = chars.size();
    let needleChars = needle.toArray();
    let needleLen = needleChars.size();

    // Find the first occurrence of needle in chars
    var pos = 0;
    var found = false;
    label search while (pos + needleLen <= len) {
      var match = true;
      var k = 0;
      while (k < needleLen) {
        if (chars[pos + k] != needleChars[k]) { match := false };
        k += 1;
      };
      if (match) { found := true; break search };
      pos += 1;
    };
    if (not found) return null;

    // pos points to start of needle; advance past it
    var i = pos + needleLen;

    // Skip whitespace, colon, more whitespace
    while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) {
      i += 1;
    };
    if (i >= len or chars[i] != ':') return null;
    i += 1; // skip ':'
    while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) {
      i += 1;
    };

    let dquote = '\u{22}';
    if (i >= len or chars[i] != dquote) return null;
    i += 1; // skip opening quote

    // Collect value characters, interpreting escape sequences
    var value = "";
    label collect while (i < len) {
      let c = chars[i];
      if (c == '\\') {
        i += 1;
        if (i >= len) break collect; // malformed — no char after backslash
        let esc = chars[i];
        if      (esc == '\u{22}') { value #= "\"" }
        else if (esc == '\\')     { value #= "\\" }
        else if (esc == '/')      { value #= "/" }
        else if (esc == 'n')      { value #= "\n" }
        else if (esc == 'r')      { value #= "\r" }
        else if (esc == 't')      { value #= "\t" }
        else if (esc == 'b')      { value #= "\u{08}" }
        else if (esc == 'f')      { value #= "\u{0C}" }
        else if (esc == 'u')      {
          // \uXXXX — skip the 4 hex digits; just drop the escape
          // (full Unicode decode not needed for ASCII content)
          var skip = 0;
          while (skip < 4 and i + 1 < len) { i += 1; skip += 1 };
        }
        else { value #= Text.fromChar(esc) }; // unknown escape: keep char
      } else if (c == dquote) {
        return ?value; // found unescaped closing quote
      } else {
        value #= Text.fromChar(c);
      };
      i += 1;
    };
    null; // unterminated string — return null gracefully
  };

  // Strip query string from URL for matching
  func urlPath(url : Text) : Text {
    switch (url.split(#char '?').next()) {
      case (?p) p;
      case null url;
    };
  };

  // --- HTTP gateway entry points ---

  // Query handler: serve all GET endpoints; signal upgrade for all POST endpoints
  public query func http_request(req : HttpRequest) : async HttpResponse {
    let path = urlPath(req.url);

    if (req.method == "GET" and path == "/api/messages") {
      let msgs = MessagesLib.getMessages(messages);
      return jsonResponse(200, messagesToJson(msgs));
    };

    if (req.method == "GET" and path == "/api/browse") {
      if (lastBrowsePending) {
        return jsonResponse(200,
          "{\"status\":\"pending\",\"request_id\":\"" # browseRequestId.toText() #
          "\",\"node_hash\":\"" # escapeJson(lastBrowseNodeHash) #
          "\",\"page_path\":\"" # escapeJson(lastBrowsePagePath) # "\"}"
        );
      } else {
        return jsonResponse(200, "{\"status\":\"idle\"}");
      };
    };

    if (req.method == "GET" and path == "/api/page") {
      if (lastPageReady) {
        return jsonResponse(200,
          "{\"status\":\"ready\",\"content\":\"" # escapeJson(lastPageContent) # "\"}"
        );
      } else {
        return jsonResponse(200, "{\"status\":\"waiting\",\"content\":\"\"}");
      };
    };

    if (req.method == "GET" and path == "/api/replies") {
      let oldest = replies.find(func(r : Types.Reply) : Bool { not r.acked });
      switch (oldest) {
        case null { return jsonResponse(200, "{}") };
        case (?r) {
          return jsonResponse(200,
            "{\"status\":\"pending\",\"reply_id\":" # r.reply_id.toText() #
            ",\"reply_to\":\"" # escapeJson(r.reply_to) #
            "\",\"content\":\"" # escapeJson(r.content) # "\"}"
          );
        };
      };
    };

    if (req.method == "GET" and path == "/api/reply-status") {
      var json = "[";
      var first = true;
      replies.forEach(func(r : Types.Reply) {
        if (r.status != "") {
          if (not first) { json #= "," };
          first := false;
          json #= "{\"reply_id\":" # r.reply_id.toText() #
            ",\"message_id\":" # r.message_id.toText() #
            ",\"status\":\"" # escapeJson(r.status) #
            "\",\"timestamp\":\"" # escapeJson(r.status_timestamp) #
            "\",\"error\":\"" # escapeJson(r.error) # "\"}";
        };
      });
      json #= "]";
      return jsonResponse(200, json);
    };

    if (req.method == "POST" and (
      path == "/api/messages" or
      path == "/api/browse" or
      path == "/api/page" or
      path == "/api/message/reply" or
      path == "/api/reply/ack" or
      path == "/api/reply-status"
    )) {
      // Signal the IC to re-invoke as an update via http_request_update
      return {
        status_code = 200;
        headers = [("Content-Type", "application/json")];
        body = "".encodeUtf8();
        upgrade = ?true;
      };
    };

    jsonResponse(404, "{\"error\":\"Not Found\"}");
  };

  // Update handler: handles all POST endpoints
  public func http_request_update(req : HttpRequest) : async HttpResponse {
    let path = urlPath(req.url);

    // Also serve GET reads here in case the IC routes them through update path
    if (req.method == "GET" and path == "/api/messages") {
      let msgs = MessagesLib.getMessages(messages);
      return jsonResponse(200, messagesToJson(msgs));
    };

    if (req.method == "GET" and path == "/api/browse") {
      if (lastBrowsePending) {
        return jsonResponse(200,
          "{\"status\":\"pending\",\"request_id\":\"" # browseRequestId.toText() #
          "\",\"node_hash\":\"" # escapeJson(lastBrowseNodeHash) #
          "\",\"page_path\":\"" # escapeJson(lastBrowsePagePath) # "\"}"
        );
      } else {
        return jsonResponse(200, "{\"status\":\"idle\"}");
      };
    };

    if (req.method == "GET" and path == "/api/page") {
      if (lastPageReady) {
        return jsonResponse(200,
          "{\"status\":\"ready\",\"content\":\"" # escapeJson(lastPageContent) # "\"}"
        );
      } else {
        return jsonResponse(200, "{\"status\":\"waiting\",\"content\":\"\"}");
      };
    };

    if (req.method == "GET" and path == "/api/replies") {
      let oldest = replies.find(func(r : Types.Reply) : Bool { not r.acked });
      switch (oldest) {
        case null { return jsonResponse(200, "{}") };
        case (?r) {
          return jsonResponse(200,
            "{\"status\":\"pending\",\"reply_id\":" # r.reply_id.toText() #
            ",\"reply_to\":\"" # escapeJson(r.reply_to) #
            "\",\"content\":\"" # escapeJson(r.content) # "\"}"
          );
        };
      };
    };

    // GET /api/reply-status — return all reply statuses
    if (req.method == "GET" and path == "/api/reply-status") {
      var json = "[";
      var first = true;
      replies.forEach(func(r : Types.Reply) {
        if (r.status != "") {
          if (not first) { json #= "," };
          first := false;
          json #= "{\"reply_id\":" # r.reply_id.toText() #
            ",\"message_id\":" # r.message_id.toText() #
            ",\"status\":\"" # escapeJson(r.status) #
            "\",\"timestamp\":\"" # escapeJson(r.status_timestamp) #
            "\",\"error\":\"" # escapeJson(r.error) # "\"}";
        };
      });
      json #= "]";
      return jsonResponse(200, json);
    };

    // POST /api/browse — frontend submits a browse request
    if (req.method == "POST" and path == "/api/browse") {
      let bodyText = switch (req.body.decodeUtf8()) {
        case null { return jsonResponse(400, "{\"error\":\"Invalid UTF-8 body\"}") };
        case (?t) t;
      };

      let nodeHash = switch (jsonGetString(bodyText, "node_hash")) {
        case null { return jsonResponse(400, "{\"error\":\"Missing field: node_hash\"}") };
        case (?s) s;
      };

      let pagePath = switch (jsonGetString(bodyText, "page_path")) {
        case null "/index.mu";
        case (?p) if (p == "") "/index.mu" else p;
      };

      lastBrowseNodeHash := nodeHash;
      lastBrowsePagePath := pagePath;
      lastBrowsePending := true;
      lastPageReady := false;
      lastPageContent := "";
      browseRequestId += 1;

      return jsonResponse(200, "{\"success\":true}");
    };

    // POST /api/page — bridge submits the fetched page content
    if (req.method == "POST" and path == "/api/page") {
      let bodyText = switch (req.body.decodeUtf8()) {
        case null { return jsonResponse(400, "{\"error\":\"Invalid UTF-8 body\"}") };
        case (?t) t;
      };

      let content = switch (jsonGetString(bodyText, "content")) {
        case null { return jsonResponse(400, "{\"error\":\"Missing field: content\"}") };
        case (?c) c;
      };

      // Truncate oversized page content to avoid cycle exhaustion on storage/retrieval
      let safeContent = truncate(content, maxContentSize);

      lastPageContent := safeContent;
      lastPageReady := true;
      lastBrowsePending := false;

      return jsonResponse(200, "{\"success\":true}");
    };

    // POST /api/message/reply — app submits an outbound reply for the bridge to send
    if (req.method == "POST" and path == "/api/message/reply") {
      let bodyText = switch (req.body.decodeUtf8()) {
        case null { return jsonResponse(400, "{\"error\":\"Invalid UTF-8 body\"}") };
        case (?t) t;
      };

      let replyToVal = switch (jsonGetString(bodyText, "reply_to")) {
        case null { return jsonResponse(400, "{\"error\":\"Missing field: reply_to\"}") };
        case (?s) s;
      };

      let replyContentVal = switch (jsonGetString(bodyText, "content")) {
        case null { return jsonResponse(400, "{\"error\":\"Missing field: content\"}") };
        case (?c) c;
      };

      // Parse message_id as numeric (0 if absent — for pre-existing messages)
      let msgIdVal : Nat = label parseMsgId : Nat {
        let needle = "\"message_id\"";
        let chars = bodyText.toArray();
        let len = chars.size();
        let needleChars = needle.toArray();
        let needleLen = needleChars.size();
        var pos = 0;
        var found = false;
        label search2 while (pos + needleLen <= len) {
          var match = true;
          var k = 0;
          while (k < needleLen) {
            if (chars[pos + k] != needleChars[k]) { match := false };
            k += 1;
          };
          if (match) { found := true; break search2 };
          pos += 1;
        };
        if (not found) break parseMsgId 0;
        var i = pos + needleLen;
        while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) { i += 1 };
        if (i >= len or chars[i] != ':') break parseMsgId 0;
        i += 1;
        while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) { i += 1 };
        var n : Nat = 0;
        var hasDigit = false;
        while (i < len) {
          let d = chars[i];
          if (d >= '0' and d <= '9') {
            let digit = (d.toNat32() - 48).toNat();
            n := n * 10 + digit;
            hasDigit := true;
            i += 1;
          } else {
            i := len;
          };
        };
        if (hasDigit) n else 0;
      };

      nextReplyId += 1;
      let newReply : Types.Reply = {
        reply_id = nextReplyId;
        reply_to = truncate(replyToVal, maxContentSize);
        content = truncate(replyContentVal, maxContentSize);
        message_id = msgIdVal;
        status = "queued";
        status_timestamp = "";
        error = "";
        acked = false;
      };
      replies.add(newReply);

      return jsonResponse(200, "{\"success\":true,\"reply_id\":" # nextReplyId.toText() # "}");
    };

    // POST /api/reply/ack — bridge confirms it sent a reply; mark it as acked
    if (req.method == "POST" and path == "/api/reply/ack") {
      let bodyText = switch (req.body.decodeUtf8()) {
        case null { return jsonResponse(400, "{\"error\":\"Invalid UTF-8 body\"}") };
        case (?t) t;
      };

      // Parse reply_id as a numeric value
      let ackIdVal : Nat = label parseAckId : Nat {
        let needle = "\"reply_id\"";
        let chars = bodyText.toArray();
        let len = chars.size();
        let needleChars = needle.toArray();
        let needleLen = needleChars.size();
        var pos = 0;
        var found = false;
        label search while (pos + needleLen <= len) {
          var match = true;
          var k = 0;
          while (k < needleLen) {
            if (chars[pos + k] != needleChars[k]) { match := false };
            k += 1;
          };
          if (match) { found := true; break search };
          pos += 1;
        };
        if (not found) break parseAckId 0;
        var i = pos + needleLen;
        while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) { i += 1 };
        if (i >= len or chars[i] != ':') break parseAckId 0;
        i += 1;
        while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) { i += 1 };
        // Handle quoted or unquoted reply_id
        let dquote = '\u{22}';
        if (i < len and chars[i] == dquote) { i += 1 };
        var n : Nat = 0;
        var hasDigit = false;
        while (i < len) {
          let d = chars[i];
          if (d >= '0' and d <= '9') {
            let digit = (d.toNat32() - 48).toNat();
            n := n * 10 + digit;
            hasDigit := true;
            i += 1;
          } else {
            i := len;
          };
        };
        if (hasDigit) n else 0;
      };

      if (ackIdVal > 0) {
        replies.mapInPlace(func(r : Types.Reply) : Types.Reply {
          if (r.reply_id == ackIdVal) { { r with acked = true } } else { r }
        });
      };

      return jsonResponse(200, "{\"success\":true}");
    };

    // POST /api/reply-status — bridge posts delivery status update for a reply
    if (req.method == "POST" and path == "/api/reply-status") {
      let bodyText = switch (req.body.decodeUtf8()) {
        case null { return jsonResponse(400, "{\"error\":\"Invalid UTF-8 body\"}") };
        case (?t) t;
      };

      // Parse reply_id as a JSON number
      let replyIdVal : Nat = label parseId : Nat {
        let needle = "\"reply_id\"";
        let chars = bodyText.toArray();
        let len = chars.size();
        let needleChars = needle.toArray();
        let needleLen = needleChars.size();
        var pos = 0;
        var found = false;
        label search while (pos + needleLen <= len) {
          var match = true;
          var k = 0;
          while (k < needleLen) {
            if (chars[pos + k] != needleChars[k]) { match := false };
            k += 1;
          };
          if (match) { found := true; break search };
          pos += 1;
        };
        if (not found) break parseId 0;
        var i = pos + needleLen;
        while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) { i += 1 };
        if (i >= len or chars[i] != ':') break parseId 0;
        i += 1;
        while (i < len and (chars[i] == ' ' or chars[i] == '\t' or chars[i] == '\n' or chars[i] == '\r')) { i += 1 };
        var n : Nat = 0;
        var hasDigit = false;
        while (i < len) {
          let d = chars[i];
          if (d >= '0' and d <= '9') {
            let digit = (d.toNat32() - 48).toNat();
            n := n * 10 + digit;
            hasDigit := true;
            i += 1;
          } else {
            i := len;
          };
        };
        if (hasDigit) n else 0;
      };

      if (replyIdVal == 0) {
        return jsonResponse(200, "{\"success\":false,\"error\":\"reply not found\"}");
      };

      let statusVal = switch (jsonGetString(bodyText, "status")) {
        case null { return jsonResponse(400, "{\"error\":\"Missing field: status\"}") };
        case (?s) s;
      };

      let timestampVal = switch (jsonGetString(bodyText, "timestamp")) {
        case null "";
        case (?t) t;
      };

      let errorVal = switch (jsonGetString(bodyText, "error")) {
        case null "";
        case (?e) e;
      };

      // Update matching reply record in-place
      var found = false;
      replies.mapInPlace(func(r : Types.Reply) : Types.Reply {
        if (r.reply_id == replyIdVal) {
          found := true;
          { r with
            status = statusVal;
            status_timestamp = truncate(timestampVal, 64);
            error = truncate(errorVal, 256);
          }
        } else { r }
      });

      if (not found) {
        return jsonResponse(200, "{\"success\":false,\"error\":\"reply not found\"}");
      };

      return jsonResponse(200, "{\"success\":true}");
    };

    // POST /api/messages
    if (req.method != "POST" or path != "/api/messages") {
      return jsonResponse(404, "{\"error\":\"Not Found\"}");
    };

    let bodyText = switch (req.body.decodeUtf8()) {
      case null { return jsonResponse(400, "{\"error\":\"Invalid UTF-8 body\"}") };
      case (?t) t;
    };

    let sender = switch (jsonGetString(bodyText, "sender")) {
      case null { return jsonResponse(400, "{\"error\":\"Missing field: sender\"}") };
      case (?s) s;
    };

    let content = switch (jsonGetString(bodyText, "content")) {
      case null { return jsonResponse(400, "{\"error\":\"Missing field: content\"}") };
      case (?c) c;
    };

    if (sender == "") {
      return jsonResponse(400, "{\"error\":\"sender must not be empty\"}");
    };
    if (content == "") {
      return jsonResponse(400, "{\"error\":\"content must not be empty\"}");
    };

    let timestamp = Time.now();
    nextMessageId += 1;
    MessagesLib.addMessage(messages, nextMessageId, sender, content, timestamp);

    jsonResponse(201, "{\"success\":true}");
  };
};
