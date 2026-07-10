import { SignupForm } from "@/components/auth/signup-form";
import { GoogleButton } from "@/components/auth/google-button";
import Image from "next/image";

const googleEnabled = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo-vaultpromo.png" alt="VaultPromo" width={140} height={40} className="h-10 w-auto object-contain" />
          <h1 className="text-2xl font-semibold text-white">Create your account</h1>
          <p className="text-sm text-white/40">Free forever · No credit card required</p>
        </div>

        {googleEnabled && (
          <>
            <GoogleButton label="Sign up with Google" />
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs text-white/20">or</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
          </>
        )}

        <SignupForm />

        <p className="text-center text-xs text-white/25">
          Already have an account?{" "}
          <a href="/login" className="text-white/50 underline-offset-2 hover:text-white/80 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
