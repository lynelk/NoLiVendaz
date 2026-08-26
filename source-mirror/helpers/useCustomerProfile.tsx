import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "../endpoints/profile_GET.schema";
import { postProfile } from "../endpoints/profile_POST.schema";
import { postPhoneOtpRequest } from "../endpoints/phone-otp/request_POST.schema";
import { postPhoneOtpVerify } from "../endpoints/phone-otp/verify_POST.schema";
import { postNinVerify } from "../endpoints/nin-verify_POST.schema";
import { postIdentityVerify } from "../endpoints/identity-verify_POST.schema";
import { getIdentityCapabilities } from "../endpoints/identity-capabilities_GET.schema";

export function useCustomerProfile(enabled = true) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => getProfile(),
    enabled,
    retry: false,
  });
  const identityCapabilitiesQuery = useQuery({
    queryKey: ["identity-capabilities"],
    queryFn: () => getIdentityCapabilities(),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const saveProfile = useMutation({
    mutationFn: postProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-profile"] }),
  });
  const requestOtp = useMutation({ mutationFn: postPhoneOtpRequest });
  const verifyOtp = useMutation({
    mutationFn: postPhoneOtpVerify,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-profile"] }),
  });
  const verifyNin = useMutation({
    mutationFn: postNinVerify,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-profile"] }),
  });
  const verifyIdentity = useMutation({
    mutationFn: postIdentityVerify,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-profile"] }),
  });
  return { profileQuery, identityCapabilitiesQuery, saveProfile, requestOtp, verifyOtp, verifyNin, verifyIdentity };
}
