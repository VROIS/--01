import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LanguageSelector from "@/components/language-selector";

export default function Landing() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-secondary to-accent flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm space-y-8">
        {/* App Logo and Title */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
            <i className="fas fa-map-marker-alt text-3xl text-primary"></i>
          </div>
          <h1 className="text-3xl font-bold text-white korean-text">{t('app.title')}</h1>
          <p className="text-white/80 korean-text">{t('app.subtitle')}</p>
        </div>

        {/* Language Selection */}
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold korean-text">{t('auth.languageSelect')}</h3>
          <LanguageSelector />
        </Card>

        {/* Simplified Authentication */}
        <Card className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold korean-text">{t('auth.simpleLogin')}</h2>
            <p className="text-sm text-muted-foreground mt-1 korean-text">{t('auth.loginSubtitle')}</p>
          </div>

          <div className="space-y-4">
            <Input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="korean-text"
              data-testid="input-email"
            />
            <Input
              type="tel"
              placeholder={t('auth.phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="korean-text"
              data-testid="input-phone"
            />
            <Button
              onClick={handleLogin}
              className="w-full korean-text"
              data-testid="button-login"
            >
              {t('auth.getVerification')}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground korean-text">
            {t('auth.terms')}
          </div>
        </Card>
      </div>
    </div>
  );
}
