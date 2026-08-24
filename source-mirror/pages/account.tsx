import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, CircleHelp, Clock3, IdCard, LogOut, Phone, ShieldCheck, Trash2, UserRound, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { CustomerBottomNav } from "../components/CustomerBottomNav";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/Dialog";
import { Input } from "../components/Input";
import { NotificationToggle } from "../components/NotificationToggle";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../helpers/useAuth";
import { useCustomerProfile } from "../helpers/useCustomerProfile";
import { getIdentityTypeDefinition } from "../helpers/identityTypes";
import { postDeleteAccount } from "../endpoints/account/delete_POST.schema";
import styles from "./account.module.css";

export default function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authState, logout } = useAuth();
  const profileQuery = useCustomerProfile(authState.type === "authenticated");
  const profile = profileQuery.profileQuery.data?.profile;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authState.type === "unauthenticated") navigate("/login", { replace: true });
  }, [authState.type, navigate]);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const deleteAccount = async () => {
    if (deletePhrase !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await postDeleteAccount();
      try { localStorage.removeItem("noli-active-rental"); } catch {}
      queryClient.clear();
      navigate("/login?deleted=1", { replace: true });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Account deletion failed.");
    } finally {
      setDeleting(false);
    }
  };

  if (authState.type === "loading" || profileQuery.profileQuery.isPending) {
    return <main className={styles.shell}><div className={styles.loading}><Skeleton/><Skeleton/><Skeleton/></div><CustomerBottomNav /></main>;
  }

  const user = authState.type === "authenticated" ? authState.user : null;
  const accountBadge = profile?.serviceAccessReady
    ? { variant: "success" as const, label: "Rental ready" }
    : profile?.profileSetupComplete
      ? { variant: "warning" as const, label: "Verification needed" }
      : { variant: "warning" as const, label: "Setup incomplete" };
  const identityLabel = profile?.identityType ? getIdentityTypeDefinition(profile.identityType).shortLabel : "Identification";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <button className={styles.brand} onClick={() => navigate("/")}><span><Zap size={17}/></span>NOLI <b>Vendaz</b></button>
        <Badge variant={accountBadge.variant}>{accountBadge.label}</Badge>
      </header>
      <section className={styles.content}>
        <div className={styles.heading}><p>YOUR ACCOUNT</p><h1>{profile?.firstName || user?.displayName || "Account"}</h1><span>Identity, refunds and security settings for your NOLI Vendaz rentals.</span></div>

        <section className={styles.identityCard}>
          <div className={styles.avatar}>{user?.avatarUrl ? <img src={user.avatarUrl} alt=""/> : <UserRound size={30}/>}</div>
          <div className={styles.identityCopy}>
            <strong>{[profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(" ") || user?.displayName}</strong>
            <span>{user?.email}</span>
          </div>
          {profile?.serviceAccessReady && <CheckCircle2 size={22} className={styles.verifiedIcon}/>} 
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}><div><span>Identity</span><h2>Customer verification</h2></div><ShieldCheck size={22}/></div>
          <div className={styles.detailRow}><span className={styles.detailIcon}><Phone size={18}/></span><div><small>Registered refund phone</small><strong>{profile?.phoneNumber || "Not linked"}</strong></div><Badge variant={profile?.phoneVerified ? "success" : "secondary"}>{profile?.phoneVerified ? "Verified" : "Optional until service"}</Badge></div>
          <div className={styles.detailRow}><span className={styles.detailIcon}><IdCard size={18}/></span><div><small>{identityLabel}</small><strong className={styles.mono}>{profile?.identityMasked || "Not provided"}</strong></div><Badge variant={profile?.identityVerificationStatus === "VERIFIED" ? "success" : "secondary"}>{profile?.identityVerificationStatus === "VERIFIED" ? "Verified" : profile?.identityConfigured ? "Not verified" : "Optional until service"}</Badge></div>
          {!profile?.serviceAccessReady && profile?.profileSetupComplete && <p className={styles.refundNote}>Your basic account is saved. Phone and identity verification become mandatory when you start a protected service such as a power-bank rental.</p>}
          <p className={styles.refundNote}>Refunds always return to the verified registered phone above, even when a rental is paid from a different mobile-money number or payment method.</p>
          <Button variant="outline" onClick={() => navigate("/onboarding")}>Edit account & verification <ChevronRight size={17}/></Button>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}><div><span>Notifications</span><h2>Rental alerts</h2></div><Zap size={22}/></div>
          <p className={styles.copy}>Get payment, release, return and refund status alerts. NOLI still keeps the authoritative rental record even if notifications are disabled.</p>
          <NotificationToggle />
        </section>

        <section className={styles.menuCard}>
          <button onClick={() => navigate("/activity")}><span><Clock3 size={19}/></span><div><strong>Rental activity</strong><small>Payments, returns and refunds</small></div><ChevronRight size={18}/></button>
          <button onClick={() => navigate("/support")}><span><CircleHelp size={19}/></span><div><strong>Help & support</strong><small>Open and track support cases</small></div><ChevronRight size={18}/></button>
        </section>

        <Button size="lg" variant="outline" className={styles.signOut} onClick={signOut}><LogOut size={18}/> Sign out</Button>

        <section className={styles.dangerCard}>
          <div><span>Account privacy</span><h2>Delete NOLI Vendaz account</h2><p>Deletion removes your identity, OAuth login, sessions, alerts and saved contact details. Settled rental records are retained only in anonymized form for transaction reconciliation.</p></div>
          <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) { setDeletePhrase(""); setDeleteError(null); } }}>
            <DialogTrigger asChild><Button variant="outline"><Trash2 size={17}/> Delete account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your NOLI Vendaz account?</DialogTitle>
                <DialogDescription>This cannot be undone. You must complete or resolve any open rental before deletion is allowed.</DialogDescription>
              </DialogHeader>
              <div className={styles.deleteBody}>
                <p>Type <strong>DELETE</strong> to confirm.</p>
                <Input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value.toUpperCase())} placeholder="DELETE" autoComplete="off" />
                {deleteError && <div className={styles.deleteError} role="alert">{deleteError}</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Keep account</Button>
                <Button variant="destructive" disabled={deletePhrase !== "DELETE" || deleting} onClick={deleteAccount}>{deleting ? "Deleting..." : "Delete permanently"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </section>
      <CustomerBottomNav />
    </main>
  );
}
