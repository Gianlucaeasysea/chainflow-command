import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Inserisci l'email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/login",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email di reset inviata — controlla la casella di posta");
      setResetMode(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-1 pb-2">
          <div className="h-10 w-10 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg font-mono">CF</span>
          </div>
          <h1 className="text-foreground font-semibold text-lg">ChainFlow</h1>
          <p className="text-muted-foreground text-sm">
            {resetMode ? "Recupera password" : "Accedi al tuo account"}
          </p>
        </CardHeader>
        <CardContent>
          {resetMode ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="email@azienda.it" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Invio…" : "Invia link di reset"}
              </Button>
              <button type="button" className="text-sm text-primary hover:underline w-full text-center" onClick={() => setResetMode(false)}>
                Torna al login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="email@azienda.it" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Accesso…" : "Accedi"}
              </Button>
              <button type="button" className="text-sm text-primary hover:underline w-full text-center" onClick={() => setResetMode(true)}>
                Password dimenticata?
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
