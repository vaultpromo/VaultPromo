import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";

const googleEnabled = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] text-white/30 uppercase">
            PromoVault
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-white/40">Sign in to your account</p>
        </div>

        {googleEnabled && (
          <>
            <GoogleButton label="Sign in with Google" />
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs text-white/20">or</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
          </>
        )}

        <LoginForm />

        <p className="text-center text-xs text-white/25">
          No account?{" "}
          <a href="/signup" className="text-white/50 underline-offset-2 hover:text-white/80 hover:underline">
            Sign up free
          </a>
        </p>
      </div>
    </div>
  );
}
