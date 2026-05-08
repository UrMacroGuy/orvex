"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<
    "weak" | "medium" | "strong" | null
  >(null);
  const { signup } = useAuth();

  const checkPasswordStrength = (pwd: string) => {
    if (pwd.length < 8) {
      setPasswordStrength("weak");
    } else if (/^[a-z0-9]+$/.test(pwd) || /^[A-Z0-9]+$/.test(pwd)) {
      setPasswordStrength("medium");
    } else {
      setPasswordStrength("strong");
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value;
    setPassword(pwd);
    checkPasswordStrength(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signup(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    authService.initiateOAuth("google");
  };

  const handleGithubSignup = () => {
    authService.initiateOAuth("github");
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case "weak":
        return "text-red-400";
      case "medium":
        return "text-yellow-400";
      case "strong":
        return "text-green-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 backdrop-blur">
          <h1 className="text-3xl font-light mb-2 text-white">Create account</h1>
          <p className="text-slate-400 mb-8">Join Orvex to orchestrate AI intelligence</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <Input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="********"
                required
                disabled={isLoading}
                className="w-full"
              />
              {password && (
                <p className={`text-xs mt-2 ${getPasswordStrengthColor()}`}>
                  Strength: {passwordStrength} (min 8 chars with uppercase, lowercase, numbers)
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !passwordStrength || passwordStrength === "weak"}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900/50 text-slate-400">Or sign up with</span>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <Button
              onClick={handleGoogleSignup}
              disabled={isLoading}
              variant="outline"
              className="w-full border-slate-700 text-slate-300"
            >
              Continue with Google
            </Button>
            <Button
              onClick={handleGithubSignup}
              disabled={isLoading}
              variant="outline"
              className="w-full border-slate-700 text-slate-300"
            >
              Continue with GitHub
            </Button>
          </div>

          <p className="text-center text-slate-400 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-sky-400 hover:text-sky-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
