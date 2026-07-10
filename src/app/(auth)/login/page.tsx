import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Sign in to your PromoVault account
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-zinc-500">
          No account?{" "}
          <a href="/signup" className="text-violet-400 hover:text-violet-300 underline">
            Sign up free
          </a>
        </p>
      </div>
    </div>
  );
}
