import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Start sending promos in minutes
          </p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <a href="/login" className="text-violet-400 hover:text-violet-300 underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
