module {
  public type Message = {
    id : Nat;
    sender : Text;
    content : Text;
    timestamp : Int;
  };

  public type Reply = {
    reply_id : Nat;
    reply_to : Text;
    content : Text;
    message_id : Nat;
    status : Text;
    status_timestamp : Text;
    error : Text;
    acked : Bool;
  };
};
