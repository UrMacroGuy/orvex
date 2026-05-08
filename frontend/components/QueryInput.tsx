import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";

export const QueryInput = ({ onSubmit }: { onSubmit: (query: string) => void }) => {
  const [text, setText] = useState("");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto p-6 bg-slate-950/50 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl"
    >
      <Textarea
        placeholder="What intelligence are you seeking today?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-transparent border-none focus-visible:ring-0 text-lg p-0 resize-none min-h-[120px]"
      />
      <div className="flex justify-end mt-4">
        <Button 
          onClick={() => onSubmit(text)}
          className="bg-slate-50 hover:bg-white text-black font-semibold px-8"
        >
          Initiate Synthesis
        </Button>
      </div>
    </motion.div>
  );
};
