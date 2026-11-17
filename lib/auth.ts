import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { rateLimit } from './rate-limit'
import { getUserAccess } from './user-administration'

// Nu folosim PrismaAdapter — cu Credentials + strategie JWT nu e nevoie de el,
// iar adapter-ul ar căuta tabele (Account, Session, VerificationToken) care
// nu există în schema noastră (avem doar User simplu, cu parolă hash-uită).
const SESSION_MAX_AGE = 60 * 60 * 24 * 90

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_MAX_AGE },
    },
  },
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE, updateAge: 60 * 60 * 24 },
  jwt: { maxAge: SESSION_MAX_AGE },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email = (credentials?.email as string)?.toLowerCase()?.trim()
        if (!email) return null

        // protecție brute-force: max 8 încercări / 15 min per email, și separat per IP —
        // ca cineva să nu poată încerca mii de parole pe un cont, oricât ar avea răbdare
        const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
        const emailCheck = rateLimit(`login-email:${email}`, 8, 15 * 60 * 1000)
        const ipCheck = rateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000)
        if (!emailCheck.allowed || !ipCheck.allowed) {
          throw new Error('Prea multe încercări. Așteaptă 15 minute și încearcă din nou.')
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null
        const access = await getUserAccess(user.id)
        if (!access || access.disabledAt) return null
        const valid = await bcrypt.compare(credentials?.password as string, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, businessId: user.businessId, role: user.role } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.businessId = (user as any).businessId
        token.role = (user as any).role
      }
      if (typeof token.id === 'string') {
        const access = await getUserAccess(token.id)
        if (!access || access.disabledAt) return null
        const accessVersion = access.accessUpdatedAt?.toISOString() ?? null
        // The access-status timestamp is also the password/session epoch. Old
        // JWTs are rejected after a password reset (and pre-deployment tokens
        // without an epoch are intentionally signed out once).
        if (!user && token.accessVersion !== accessVersion) return null
        token.accessVersion = accessVersion
        token.email = access.email
        token.businessId = access.businessId
        token.role = access.role
      }
      return token
    },
    async session({ session, token }) {
      ;(session as any).userId = token.id
      ;(session as any).businessId = token.businessId
      ;(session as any).role = token.role
      ;(session as any).isSuperAdmin = token.role === 'SUPER_ADMIN'
      return session
    },
  },
  pages: { signIn: '/login' },
})
