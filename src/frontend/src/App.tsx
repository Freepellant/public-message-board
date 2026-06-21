import { Toaster } from "@/components/ui/sonner";
import Board from "./pages/Board";

export default function App() {
  return (
    <>
      <div className="min-h-screen flex flex-col bg-background">
        <Board />
      </div>
      <Toaster position="bottom-right" />
    </>
  );
}
