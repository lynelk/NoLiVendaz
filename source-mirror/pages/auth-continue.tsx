import React, { useEffect } from "react";
import { ShieldCheck, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { useCustomerProfile } from "../helpers/useCustomerProfile";
import { sanitizeResumePath } from "../helpers/sanitizeResumePath";
import styles from "./auth-continue.module.css";

export default function AuthContinuePage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const profile = useCustomerProfile(authState.type === "authenticated");
  const resumePath = sanitizeResumePath(new URLSearchParams(window.location.search).get("resume"));

  useEffect(() => {
    if (authState.type === "unauthenticated") {
      navigate(`/login?resume=${encodeURIComponent(resumePath)}`, { replace: true });
      return;
    }
    if (authState.type !== "authenticated" || !profile.profileQuery.isSuccess) return;
    const customer = profile.profileQuery.data?.profile;
    navigate(customer?.registrationComplete ? resumePath : `/onboarding?resume=${encodeURIComponent(resumePath)}`, { replace: true });
  }, [authState.type, profile.profileQuery.isSuccess, profile.profileQuery.data?.profile?.registrationComplete, navigate, resumePath]);

  return (
    <main className={styles.shell}>
      <div className={styles.mark}><Zap size={24}/></div>
      <ShieldCheck size={26}/>
      <h1>Preparing your NOLI account</h1>
      <p>{profile.profileQuery.isError ? "We could not load your saved profile. Check your connection and retry rather than starting setup again." : "Checking your saved customer profile before continuing. Service-specific verification is enforced when you use a protected service."}</p>
      {profile.profileQuery.isError && <button type="button" onClick={() => profile.profileQuery.refetch()}>Retry profile check</button>}
    </main>
  );
}
