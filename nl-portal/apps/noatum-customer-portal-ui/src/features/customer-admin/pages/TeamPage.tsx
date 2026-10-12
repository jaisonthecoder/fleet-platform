import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';

import type { components } from '../../../api/generated/schema';
import { Button, DateValue } from '../../../design-system';
import { CustomerMeasure } from '../../../shared/layouts/customer-shell';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import {
  useChangeRoles,
  useInviteColleague,
  useResendInvitation,
  useRevokeInvitation,
  useRolePresets,
  useSetUserStatus,
  useTeam,
  useTeamInvitations,
  type AccountUser,
} from '../api/team';
import styles from './TeamPage.module.css';

type CurrentUser = components['schemas']['CurrentUserDto'] | undefined;

const RESEND_LIMIT = 3;

/**
 * The customer's own people.
 *
 * Noatum appoints the first administrator; from there the customer runs its own
 * access, which is the half of onboarding that did not exist. Everything on this
 * page is scoped by the session — there is no customer to choose, and the API
 * would refuse one.
 *
 * The server owns every rule this screen appears to enforce: the email domain,
 * the last administrator, which roles can be granted, the resend cap. The form
 * mirrors them so the answer is immediate, never so that it is the only check.
 */
export function TeamPage() {
  const { t } = useTranslation();
  const user = useOutletContext<CurrentUser>();
  const canManage = user?.permissions?.includes('users.manage') ?? false;

  const team = useTeam();
  const invitations = useTeamInvitations();
  const presets = useRolePresets();

  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<AccountUser | null>(null);

  const pending = (invitations.data ?? []).filter((entry) => entry.status === 'pending');
  const loading = team.isPending || invitations.isPending;
  const failed = team.isError || invitations.isError;

  return (
    <>
      <section className={styles.hero} aria-labelledby="team-heading">
        <div className={styles.heroInner}>
          <Breadcrumb
            tone="hero"
            items={[{ label: t('customerNav_dashboard'), to: '/app/dashboard' }, { label: t('teamTitle') }]}
          />
          <h1 id="team-heading" className={styles.heading}>{t('teamTitle')}</h1>
          <div className={styles.rule} />
          <p className={styles.lede}>{t('teamLede')}</p>
        </div>
      </section>

      <CustomerMeasure>
        <div className={styles.page}>
          {failed && (
            <div className={styles.state} role="alert">
              <p className={styles.stateTitle}>{t('teamFailed')}</p>
              <p>{t('teamFailedNote')}</p>
              <Button variant="outline" onClick={() => void team.refetch()}>{t('retry')}</Button>
            </div>
          )}

          {/* ── people ─────────────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="team-people">
            <header className={styles.cardHead}>
              <div style={{ minWidth: 0 }}>
                <h2 id="team-people" className={styles.cardTitle}>{t('teamPeople')}</h2>
                <p className={styles.cardNote}>{t('teamPeopleNote')}</p>
              </div>
              {canManage && (
                <Button onClick={() => setInviting(true)}>{t('teamInvite')}</Button>
              )}
            </header>

            {loading ? (
              <p className={styles.empty} role="status">{t('teamLoading')}</p>
            ) : (team.data ?? []).length === 0 ? (
              <p className={styles.empty}>{t('teamNobody')}</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('teamColPerson')}</th>
                      <th scope="col">{t('teamColRoles')}</th>
                      <th scope="col">{t('teamColOffice')}</th>
                      <th scope="col">{t('teamColStatus')}</th>
                      <th scope="col">{t('teamColLastSignIn')}</th>
                      {canManage && <th scope="col"><span className="sr-only">{t('actions')}</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(team.data ?? []).map((member) => (
                      <tr key={member.id}>
                        <td>
                          <span className={styles.person}>{member.displayName}</span>
                          <span className={styles.email}>{member.email}</span>
                        </td>
                        <td>
                          <span className={styles.roles}>
                            {member.roleNames.map((name) => (
                              <span className={styles.role} key={name}>{name}</span>
                            ))}
                          </span>
                        </td>
                        <td>{member.officeName ?? t('teamAllOffices')}</td>
                        <td>
                          <span className={styles.status} data-status={member.status}>
                            {t(`teamStatus_${member.status}`)}
                          </span>
                        </td>
                        <td>
                          {member.lastLoginAt ? <DateValue value={member.lastLoginAt} /> : t('teamNeverSignedIn')}
                        </td>
                        {canManage && (
                          <td className={styles.rowActions}>
                            <button type="button" className={styles.link} onClick={() => setEditing(member)}>
                              {t('teamChange')}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── invitations ────────────────────────────────────────────── */}
          {canManage && (
            <section className={styles.card} aria-labelledby="team-invitations">
              <header className={styles.cardHead}>
                <div style={{ minWidth: 0 }}>
                  <h2 id="team-invitations" className={styles.cardTitle}>{t('teamPending')}</h2>
                  <p className={styles.cardNote}>{t('teamPendingNote')}</p>
                </div>
              </header>

              {pending.length === 0 ? (
                <p className={styles.empty}>{t('teamNoPending')}</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">{t('teamColPerson')}</th>
                        <th scope="col">{t('teamColRoles')}</th>
                        <th scope="col">{t('teamColExpires')}</th>
                        <th scope="col">{t('teamColResends')}</th>
                        <th scope="col"><span className="sr-only">{t('actions')}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((entry) => (
                        <InvitationRow key={entry.id} invitation={entry} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </CustomerMeasure>

      {inviting && (
        <InviteDialog
          presets={presets.data ?? []}
          offices={[]}
          onClose={() => setInviting(false)}
        />
      )}
      {editing && (
        <ChangeRolesDialog
          member={editing}
          presets={presets.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function InvitationRow({ invitation }: { invitation: components['schemas']['AccountInvitationDto'] }) {
  const { t } = useTranslation();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const exhausted = invitation.resendCount >= RESEND_LIMIT;

  return (
    <tr>
      <td>
        <span className={styles.person}>{invitation.displayName ?? invitation.email}</span>
        <span className={styles.email}>{invitation.email}</span>
      </td>
      <td>
        <span className={styles.roles}>
          {invitation.roleKeys.map((key) => (
            <span className={styles.role} key={key}>{t(`role_${key}`)}</span>
          ))}
        </span>
      </td>
      <td><DateValue value={invitation.expiresAt} /></td>
      <td>{t('teamResendsUsed', { used: invitation.resendCount, limit: RESEND_LIMIT })}</td>
      <td className={styles.rowActions}>
        <button
          type="button"
          className={styles.link}
          disabled={exhausted || resend.isPending}
          title={exhausted ? t('teamResendExhausted') : undefined}
          onClick={() => resend.mutate({ id: invitation.id, reason: t('teamResendReason') })}
        >
          {t('teamResend')}
        </button>
        <button
          type="button"
          className={styles.linkDanger}
          disabled={revoke.isPending}
          onClick={() => revoke.mutate({ id: invitation.id, reason: t('teamRevokeReason') })}
        >
          {t('teamRevoke')}
        </button>
      </td>
    </tr>
  );
}

function RolePicker({
  presets,
  selected,
  onChange,
}: {
  presets: components['schemas']['AccountRolePresetDto'][];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{t('teamRoles')}</legend>
      <p className={styles.hint}>{t('teamRolesHint')}</p>
      <div className={styles.roleList}>
        {presets.map((preset) => (
          <label className={styles.roleOption} key={preset.key}>
            <input
              type="checkbox"
              checked={selected.includes(preset.key)}
              onChange={() => toggle(preset.key)}
            />
            <span>
              <span className={styles.roleName}>{preset.name}</span>
              {preset.description && <span className={styles.roleDesc}>{preset.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InviteDialog({
  presets,
  offices,
  onClose,
}: {
  presets: components['schemas']['AccountRolePresetDto'][];
  offices: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const invite = useInviteColleague();
  const [form, setForm] = useState({ displayName: '', email: '', officeAccountId: '' });
  const [roleKeys, setRoleKeys] = useState<string[]>(['customer_standard']);

  const canSend = form.displayName.trim().length > 1 && form.email.includes('@') && roleKeys.length > 0;

  return (
    <Dialog title={t('teamInviteTitle')} onClose={onClose}>
      <p className={styles.dialogNote}>{t('teamInviteNote')}</p>

      <label className={styles.label} htmlFor="invite-name">{t('teamName')}</label>
      <input
        id="invite-name"
        className={styles.input}
        value={form.displayName}
        onChange={(event) => setForm((f) => ({ ...f, displayName: event.target.value }))}
      />

      <label className={styles.label} htmlFor="invite-email">{t('teamEmail')}</label>
      <input
        id="invite-email"
        type="email"
        className={styles.input}
        value={form.email}
        onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
      />
      <p className={styles.hint}>{t('teamEmailHint')}</p>

      <RolePicker presets={presets} selected={roleKeys} onChange={setRoleKeys} />

      {offices.length > 0 && (
        <>
          <label className={styles.label} htmlFor="invite-office">{t('teamOffice')}</label>
          <select
            id="invite-office"
            className={styles.input}
            value={form.officeAccountId}
            onChange={(event) => setForm((f) => ({ ...f, officeAccountId: event.target.value }))}
          >
            <option value="">{t('teamAllOffices')}</option>
            {offices.map((office) => (
              <option key={office.id} value={office.id}>{office.name}</option>
            ))}
          </select>
        </>
      )}

      {invite.isError && (
        <p className={styles.error} role="alert">{(invite.error as Error).message}</p>
      )}
      {invite.isSuccess && invite.data.inviteUrl && (
        <p className={styles.notice} role="status">
          {t('teamInviteLink')} <code className={styles.code}>{invite.data.inviteUrl}</code>
        </p>
      )}

      <div className={styles.dialogActions}>
        <Button variant="outline" onClick={onClose}>{invite.isSuccess ? t('close') : t('cancel')}</Button>
        <Button
          disabled={!canSend || invite.isPending}
          onClick={() =>
            invite.mutate({
              displayName: form.displayName.trim(),
              email: form.email.trim(),
              roleKeys,
              officeAccountId: form.officeAccountId || null,
            })
          }
        >
          {invite.isPending ? t('teamSending') : t('teamSendInvite')}
        </Button>
      </div>
    </Dialog>
  );
}

function ChangeRolesDialog({
  member,
  presets,
  onClose,
}: {
  member: AccountUser;
  presets: components['schemas']['AccountRolePresetDto'][];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const change = useChangeRoles();
  const status = useSetUserStatus();
  const [roleKeys, setRoleKeys] = useState<string[]>(member.roleKeys);
  const [reason, setReason] = useState('');

  const canSave = roleKeys.length > 0 && reason.trim().length > 0 && !change.isPending;
  const error = (change.error ?? status.error) as Error | null;

  return (
    <Dialog title={t('teamChangeTitle', { name: member.displayName })} onClose={onClose}>
      <RolePicker presets={presets} selected={roleKeys} onChange={setRoleKeys} />

      <label className={styles.label} htmlFor="change-reason">{t('teamReason')}</label>
      <input
        id="change-reason"
        className={styles.input}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <p className={styles.hint}>{t('teamReasonHint')}</p>

      {error && <p className={styles.error} role="alert">{error.message}</p>}

      <div className={styles.dialogActions}>
        {/* Deactivation is destructive enough to sit apart from the save action,
            and the server refuses it for the last administrator and for self. */}
        {!member.isSelf && (
          <button
            type="button"
            className={styles.linkDanger}
            disabled={status.isPending || reason.trim().length === 0}
            onClick={() =>
              status.mutate(
                { id: member.id, active: member.status === 'disabled', reason: reason.trim() },
                { onSuccess: onClose },
              )
            }
          >
            {member.status === 'disabled' ? t('teamReactivate') : t('teamDeactivate')}
          </button>
        )}
        <span className={styles.spacer} />
        <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        <Button
          disabled={!canSave}
          onClick={() =>
            change.mutate(
              { id: member.id, roleKeys, officeAccountId: null, reason: reason.trim() },
              { onSuccess: onClose },
            )
          }
        >
          {t('save')}
        </Button>
      </div>
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className={styles.scrim} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.dialogTitle}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default TeamPage;
