import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/[0.06] via-background to-background">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold font-mono text-primary">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("notfound_message")}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t("notfound_home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
