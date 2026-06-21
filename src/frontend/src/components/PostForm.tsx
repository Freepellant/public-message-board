import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useAddMessage } from "../hooks/useMessages";

export function PostForm() {
  const addMessage = useAddMessage();
  const [sender, setSender] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<{ sender?: string; content?: string }>(
    {},
  );

  function validate() {
    const e: { sender?: string; content?: string } = {};
    if (!sender.trim()) e.sender = "Name is required.";
    if (!content.trim()) e.content = "Message cannot be empty.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await addMessage.mutateAsync({
        sender: sender.trim(),
        content: content.trim(),
      });
      setSender("");
      setContent("");
      setErrors({});
      toast.success("Message posted.");
    } catch {
      toast.error("Failed to post message. Please try again.");
    }
  }

  return (
    <section data-ocid="post.section">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="sender"
            className="text-sm font-medium text-foreground"
          >
            Your name
          </Label>
          <Input
            id="sender"
            data-ocid="post.sender.input"
            placeholder="e.g. Jane Doe"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            onBlur={() => {
              if (!sender.trim())
                setErrors((p) => ({ ...p, sender: "Name is required." }));
              else setErrors((p) => ({ ...p, sender: undefined }));
            }}
            className="bg-card border-border text-foreground placeholder:text-muted-foreground"
            aria-invalid={!!errors.sender}
            aria-describedby={errors.sender ? "sender-error" : undefined}
          />
          {errors.sender && (
            <p
              id="sender-error"
              data-ocid="post.sender.field_error"
              className="text-xs text-destructive"
            >
              {errors.sender}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="content"
            className="text-sm font-medium text-foreground"
          >
            Message
          </Label>
          <Textarea
            id="content"
            data-ocid="post.content.textarea"
            placeholder="What's on your mind?"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => {
              if (!content.trim())
                setErrors((p) => ({
                  ...p,
                  content: "Message cannot be empty.",
                }));
              else setErrors((p) => ({ ...p, content: undefined }));
            }}
            className="resize-none bg-card border-border text-foreground placeholder:text-muted-foreground"
            aria-invalid={!!errors.content}
            aria-describedby={errors.content ? "content-error" : undefined}
          />
          {errors.content && (
            <p
              id="content-error"
              data-ocid="post.content.field_error"
              className="text-xs text-destructive"
            >
              {errors.content}
            </p>
          )}
        </div>

        <Button
          type="submit"
          data-ocid="post.submit_button"
          disabled={addMessage.isPending}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors duration-200 font-medium"
        >
          {addMessage.isPending ? "Posting…" : "Post Message"}
        </Button>

        {addMessage.isPending && (
          <p data-ocid="post.loading_state" className="sr-only">
            Posting message…
          </p>
        )}
      </form>
    </section>
  );
}
