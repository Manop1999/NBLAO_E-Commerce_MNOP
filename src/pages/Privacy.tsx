import { useT } from '../i18n'

const NAVY = 'var(--nb-navy)'
const GOLD = 'var(--nb-gold)'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h2 className="font-display font-700 text-[19px] mb-3" style={{ color: NAVY }}>{title}</h2>
    <div className="font-ui text-[13px] leading-[1.75] space-y-3" style={{ color: '#374151' }}>
      {children}
    </div>
  </div>
)

export default function Privacy() {
  const t = useT()
  const year = new Date().getFullYear()

  return (
    <div>
      <div style={{ background: NAVY, padding: '40px 0' }}>
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-8" style={{ background: GOLD, opacity: 0.5 }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>Legal</span>
          </div>
          <h1 className="font-display font-800 text-[32px] text-white">{t.privacy.title}</h1>
          <p className="font-ui text-[13px] mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Last updated: January {year}
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 py-12">
        <div className="max-w-[760px]">
          <p className="font-ui text-[13px] leading-[1.75] mb-8" style={{ color: '#374151' }}>
            NB Lao Sole Co., Ltd. ("NB LAO", "we", "us", or "our") is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, and safeguard information when you use our
            B2B industrial procurement platform.
          </p>

          <Section title="1. Information We Collect">
            <p>We collect information you provide directly, including:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Name, email address, phone number, and company details during registration</li>
              <li>Billing and shipping addresses for order fulfilment</li>
              <li>Order history, quotation requests, and product enquiries</li>
              <li>Communications you send to our sales and support teams</li>
            </ul>
            <p>We also collect usage data automatically, including browser type, pages visited, and referral source for analytics purposes.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use your information to:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Process and manage your orders, quotations, and account</li>
              <li>Send order confirmations, shipping updates, and account notifications</li>
              <li>Respond to your enquiries and provide customer support</li>
              <li>Improve our platform and product offerings</li>
              <li>Comply with legal and regulatory obligations in the Lao PDR</li>
            </ul>
          </Section>

          <Section title="3. Data Sharing">
            <p>
              We do not sell your personal information. We may share data with trusted third-party service providers
              (logistics, payment processors) strictly for order fulfilment. We may disclose information when required
              by Lao law or regulatory authorities.
            </p>
          </Section>

          <Section title="4. Data Retention">
            <p>
              We retain your account data while your account is active and for a period thereafter as required by
              applicable law and our business records obligations. You may request deletion of your data by contacting us.
            </p>
          </Section>

          <Section title="5. Security">
            <p>
              We implement industry-standard technical and organisational measures to protect your data.
              However, no method of transmission over the internet is completely secure. This platform is currently
              a prototype; production deployment will include additional security controls.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>You have the right to access, correct, or request deletion of your personal data. Contact our team at the address below to exercise these rights.</p>
          </Section>

          <Section title="7. Contact">
            <p>
              NB Lao Sole Co., Ltd.<br />
              Vientiane, Lao PDR<br />
              Email: legal@nblao.la
            </p>
          </Section>

          <div className="mt-8 pt-6 font-ui text-[12px]" style={{ borderTop: '1px solid #e5e7eb', color: '#9ca3af' }}>
            © {year} NB Lao Sole Co., Ltd. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  )
}
