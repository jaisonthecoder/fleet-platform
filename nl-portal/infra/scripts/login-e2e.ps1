$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:43000'

function Call($method, $path, $subject, $email, $body) {
  $headers = @{
    'X-Dev-User-Subject' = $subject
    'X-Dev-User-Email'   = $email
    'X-Dev-User-Name'    = $email
  }
  $params = @{ Method = $method; Uri = "$base$path"; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 15 }
  if ($null -ne $body) {
    $params.Body = ($body | ConvertTo-Json -Depth 6)
    $params.ContentType = 'application/json'
  }
  try {
    $r = Invoke-WebRequest @params
    return [pscustomobject]@{ Status = [int]$r.StatusCode; Body = ($r.Content | ConvertFrom-Json) }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return [pscustomobject]@{ Status = $code; Body = $null }
  }
}

function Check($label, $actual, $expected) {
  $pass = "$actual" -eq "$expected"
  $mark = if ($pass) { 'PASS' } else { 'FAIL' }
  Write-Output ("  [{0}] {1,-50} got={2} expected={3}" -f $mark, $label, $actual, $expected)
  if (-not $pass) { $script:failures++ }
}

$script:failures = 0
$adminSub = 'dev-platform-admin';  $adminMail = 'platform.admin@adports.ae'
$starterSub = 'dev-new-starter';   $starterMail = 'new.starter@adports.ae'
$bootSub = 'boot-0001';            $bootMail = 'omar.aljaber@adports.ae'
$outsideSub = 'outsider-0001';     $outsideMail = 'someone@gmail.com'

Write-Output '1. Demo Platform Admin signs in'
$me = Call GET '/api/me' $adminSub $adminMail
$perms = @($me.Body.permissions)
Check 'sign-in succeeds' $me.Status 200
Check 'is internal staff' $me.Body.isInternal 'True'
Check 'can read the staff directory' ($perms -contains 'admin.staff.read') 'True'
Check 'can assign staff roles' ($perms -contains 'admin.staff.roles.manage') 'True'
Check 'administration does NOT grant cost data' ($perms -contains 'pricing.cost.view') 'False'
Check 'administration does NOT grant impersonation' ($perms -contains 'admin.impersonate') 'False'

Write-Output ''
Write-Output '2. Configured bootstrap administrator can always get in'
$boot = Call GET '/api/me' $bootSub $bootMail
Check 'bootstrap sign-in succeeds' $boot.Status 200
Check 'bootstrap holds staff administration' ((@($boot.Body.permissions)) -contains 'admin.staff.roles.manage') 'True'

Write-Output ''
Write-Output '3. New employee is recognised but has no business access'
$starter = Call GET '/api/me' $starterSub $starterMail
Check 'sign-in succeeds' $starter.Status 200
Check 'holds no permissions at all' (@($starter.Body.permissions).Count) 0
Check 'staff directory refused' (Call GET '/api/users/staff' $starterSub $starterMail).Status 403

Write-Output ''
Write-Output '4. Identity outside the staff domain cannot self-register'
Check 'refused at the door' (Call GET '/api/me' $outsideSub $outsideMail).Status 401

Write-Output ''
Write-Output '5. Administrator reads the directory and the assignable presets'
$list = Call GET '/api/users/staff?page=1&pageSize=50' $adminSub $adminMail
Check 'directory readable' $list.Status 200
$presets = Call GET '/api/users/staff/role-presets' $adminSub $adminMail
Check 'five internal presets offered' (@($presets.Body).Count) 5
Write-Output ("       presets: {0}" -f (($presets.Body | ForEach-Object { $_.key }) -join ', '))
Write-Output ("       directory ({0} people):" -f $list.Body.total)
foreach ($u in $list.Body.items) {
  Write-Output ("         {0,-30} {1,-11} [{2}]" -f $u.email, $u.status, ($u.roleKeys -join ','))
}

Write-Output ''
Write-Output '6. Administrator grants the Pricing preset to the new employee'
$target = $list.Body.items | Where-Object { $_.email -eq $starterMail } | Select-Object -First 1
$assign = Call PUT "/api/users/staff/$($target.id)/roles" $adminSub $adminMail @{
  roleKeys = @('pricing'); updatedAt = $target.updatedAt; reason = 'End to end verification'
}
Check 'assignment accepted' $assign.Status 200
Check 'role recorded' ($assign.Body.roleKeys -join ',') 'pricing'
Check 'access pending becomes active' $assign.Body.status 'active'

Write-Output ''
Write-Output '7. The grant applies on the next request, with no new sign-in'
$after = Call GET '/api/me' $starterSub $starterMail
$afterPerms = @($after.Body.permissions)
Check 'can now see the pricing queue' ($afterPerms -contains 'pricing.queue.read') 'True'
Check 'can now price' ($afterPerms -contains 'pricing.price') 'True'
Check 'still cannot approve pricing' ($afterPerms -contains 'pricing.approve') 'False'
Check 'still cannot see cost' ($afterPerms -contains 'pricing.cost.view') 'False'

Write-Output ''
Write-Output '8. Pricing staff cannot administer or escalate'
Check 'directory still refused' (Call GET '/api/users/staff' $starterSub $starterMail).Status 403
$escalate = Call PUT "/api/users/staff/$($target.id)/roles" $starterSub $starterMail @{
  roleKeys = @('platform_admin'); updatedAt = $assign.Body.updatedAt; reason = 'Attempted self escalation'
}
Check 'self escalation refused' $escalate.Status 403

Write-Output ''
Write-Output '9. A stale edit is rejected instead of overwriting'
$stale = Call PUT "/api/users/staff/$($target.id)/roles" $adminSub $adminMail @{
  roleKeys = @(); updatedAt = $target.updatedAt; reason = 'Stale write attempt'
}
Check 'stale version rejected' $stale.Status 409

Write-Output ''
Write-Output '10. Restore the demo identity to access-pending'
$current = (Call GET "/api/users/staff?search=$starterMail" $adminSub $adminMail).Body.items[0]
$reset = Call PUT "/api/users/staff/$($current.id)/roles" $adminSub $adminMail @{
  roleKeys = @(); updatedAt = $current.updatedAt; reason = 'Reset demo identity after verification'
}
Check 'roles removed' (@($reset.Body.roleKeys).Count) 0

Write-Output ''
if ($script:failures -eq 0) { Write-Output 'RESULT: all checks passed' }
else { Write-Output ("RESULT: {0} check(s) FAILED" -f $script:failures); exit 1 }
