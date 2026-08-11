import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMyCredentials,
  updateMyCredentials,
  updatePersonCredentials,
  type MyCredentials,
  type UpdateCredentialsInput,
} from './credential.contract'

const MY_CREDENTIALS_KEY = ['me', 'credentials'] as const

/** The signed-in user's own driver-credential status (autofill + warnings). */
export function useMyCredentials() {
  return useQuery({
    queryKey: MY_CREDENTIALS_KEY,
    queryFn: fetchMyCredentials,
  })
}

/** Self-service capture of the caller's own licence / Emirates ID. */
export function useUpdateMyCredentials() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCredentialsInput) => updateMyCredentials(input),
    onSuccess: (data: MyCredentials) =>
      queryClient.setQueryData(MY_CREDENTIALS_KEY, data),
  })
}

/** Admin/steward capture of a specific person's credentials. */
export function useUpdatePersonCredentials(personId: string) {
  return useMutation({
    mutationFn: (input: UpdateCredentialsInput) =>
      updatePersonCredentials(personId, input),
  })
}
