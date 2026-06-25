import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  lang?: string;
  className?: string;
}

const VoiceInputButton = ({ onResult, lang, className }: VoiceInputButtonProps) => {
  const { t, lang: appLang } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const recognitionLang = lang ?? (appLang === "zh" ? "zh-HK" : "en-US");

  const toggle = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t("voice_not_supported"));
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = recognitionLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        toast.error(t("voice_mic_denied"));
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, recognitionLang, onResult, t]);

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={toggle}
      className={className}
      title={isListening ? t("voice_stop") : t("voice_start")}
    >
      {isListening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
};

export default VoiceInputButton;
