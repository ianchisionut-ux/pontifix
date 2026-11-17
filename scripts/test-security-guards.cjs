const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const auth = read('lib/auth.ts')
assert.doesNotMatch(auth, /berar_liviu@yahoo\.com|contabilitate@elmont\.ro|ianchisionut@gmail\.com/i)
assert.match(auth, /token\.accessVersion !== accessVersion/)

const offerAccess = read('lib/offer-access.ts')
assert.doesNotMatch(offerAccess, /berar_liviu@yahoo\.com/i)
assert.match(offerAccess, /const canManage = role !== 'STAFF'/)

const userAdministration = read('lib/user-administration.ts')
assert.match(userAdministration, /export async function invalidateUserSessions/)
assert.match(userAdministration, /DO UPDATE SET "updatedAt" = GREATEST\(CURRENT_TIMESTAMP/)

const employees = read('app/api/attendance/employees/route.ts')
assert.match(employees, /role === 'STAFF'\) return undefined/)

const attendanceExport = read('app/api/attendance/export/route.ts')
assert.match(attendanceExport, /role === 'STAFF'\) return NextResponse\.json\([^\n]+status: 403/)

const formsPage = read('app/dashboard/formulare/page.tsx')
assert.match(formsPage, /canAccessIdentityData \? listIdentityCards\(businessId\) : Promise\.resolve\(\[\]\)/)
assert.match(formsPage, /NOT LIKE 'IDENTITY%'/)
assert.match(formsPage, /NULL::text AS "sourceType", NULL::text AS "sourceId"/)
assert.match(formsPage, /'\{\}'::jsonb AS "values"/)
assert.match(formsPage, /sourceType: canAccessIdentityData \? row\.sourceType : null/)
assert.match(formsPage, /values: canAccessIdentityData \? row\.values \|\| \{\} : \{\}/)
assert.match(formsPage, /fieldSchema: canAccessIdentityData && Array\.isArray\(row\.fieldSchema\) \? row\.fieldSchema : \[\]/)

const formSubmissions = read('app/api/formulare/submissions/route.ts')
assert.doesNotMatch(formSubmissions, /export async function GET/)
assert.match(formSubmissions, /role === 'STAFF'\) return NextResponse\.json\([^\n]+status: 403/)

const formSubmission = read('app/api/formulare/submissions/[id]/route.ts')
assert.doesNotMatch(formSubmission, /export async function GET/)
assert.match(formSubmission, /role === 'STAFF'\) return NextResponse\.json\([^\n]+status: 403/)

const formsManager = read('components/forms/forms-manager.tsx')
assert.match(formsManager, /\{canEdit && <button[\s\S]{0,300}setCategory\('CI'\)/)

const whatsapp = read('app/api/webhooks/whatsapp/route.ts')
assert.match(whatsapp, /if \(!appSecret\) return false/)

const setup = read('app/api/setup/route.ts')
assert.match(setup, /pg_advisory_xact_lock/)
assert.match(setup, /if \(await tx\.user\.count\(\)\) return false/)
assert.ok(setup.indexOf('await prisma.user.count()') < setup.indexOf('await bcrypt.hash(password, 12)'), 'Setup must reject initialized databases before bcrypt')

const resetPassword = read('app/api/auth/reset-password/route.ts')
assert.match(resetPassword, /select: \{ usedAt: true, expiresAt: true \}/)
assert.match(resetPassword, /usedAt: null, expiresAt: \{ gt: usedAt \}/)
assert.match(resetPassword, /invalidateUserSessions\(record\.userId, tx\)/)

const ownPassword = read('app/api/account/password/route.ts')
assert.match(ownPassword, /invalidateUserSessions\(userId, tx\)/)

const adminUser = read('app/api/admin/users/[id]/route.ts')
assert.equal((adminUser.match(/invalidateUserSessions\(id, tx\)/g) ?? []).length, 2)

const nextConfig = read('next.config.js')
for (const header of [
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security',
]) {
  assert.ok(nextConfig.includes(header), `Missing global security header: ${header}`)
}

console.log('Security guard regression checks passed.')
