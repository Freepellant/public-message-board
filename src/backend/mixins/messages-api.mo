import Types "../types/messages";
import MessagesLib "../lib/messages";
import List "mo:core/List";
import Time "mo:core/Time";

mixin (messages : List.List<Types.Message>) {
  public query func getMessages() : async [Types.Message] {
    MessagesLib.getMessages(messages);
  };

  public func addMessage(sender : Text, content : Text) : async () {
    let timestamp = Time.now();
    MessagesLib.addMessage(messages, 0, sender, content, timestamp);
  };
};
