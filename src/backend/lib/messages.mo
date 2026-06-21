import Types "../types/messages";
import List "mo:core/List";
import Int "mo:core/Int";

module {
  public type Message = Types.Message;

  public func addMessage(
    messages : List.List<Message>,
    id : Nat,
    sender : Text,
    content : Text,
    timestamp : Int,
  ) : () {
    messages.add({ id; sender; content; timestamp });
  };

  public func getMessages(messages : List.List<Message>) : [Message] {
    let arr = messages.toArray();
    arr.sort(func(a, b) = Int.compare(b.timestamp, a.timestamp));
  };
};
