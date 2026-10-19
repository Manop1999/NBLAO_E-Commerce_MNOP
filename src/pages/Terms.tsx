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

export default function Terms() {
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
          <h1 className="font-display font-800 text-[32px] text-white">{t.terms.title}</h1>
          <p className="font-ui text-[13px] mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Last updated: January {year}
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 py-12">
        <div className="max-w-[760px]">
          <p className="font-ui text-[13px] leading-[1.75] mb-8" style={{ color: '#374151' }}>
            These Terms of Service govern your use of the NB LAO B2B industrial procurement platform operated
            by NB Lao Sole Co., Ltd. By creating an account or placing orders you agree to these terms.
          </p>

          <Section title="1. Eligibility and Account">
            <p>
              This platform is intended for business customers (B2B). You must be an authorised representative
              of a registered business entity to create an account. You are responsible for maintaining the
              confidentiality of your account credentials.
            </p>
          </Section>

          <Section title="2. Orders and Pricing">
            <ul className="list-disc ml-5 space-y-1">
              <li>All prices are displayed in USD unless otherwise noted and are subject to change without notice.</li>
              <li>Minimum order quantities (MOQ) apply to certain products as indicated on product pages.</li>
              <li>Order placement constitutes an offer to purchase; orders are confirmed upon written acceptance by NB LAO.</li>
              <li>Lead times shown are estimates only and are not guaranteed.</li>
            </ul>
          </Section>

          <Section title="3. Quotations and RFQ">
            <p>
              Request for Quotation (RFQ) submissions are non-binding enquiries. A formal quotation from NB LAO
              remains valid for 30 days unless otherwise stated. Quoted prices are subject to availability at
              time of order placement.
            </p>
          </Section>

          <Section title="4. Payment Terms">
            <p>
              Standard payment terms are 30 days from invoice date for approved credit accounts.
              New accounts may require advance payment or letter of credit. Late payments may incur interest
              in accordance with Lao commercial law.
            </p>
          </Section>

          <Section title="5. Delivery and Risk">
            <p>
              Delivery terms are EXW Vientiane, Lao PDR unless otherwise agreed in writing. Risk of loss
              transfers to the buyer upon handover to the first carrier. NB LAO is not liable for delays
              caused by force majeure, customs, or carrier issues.
            </p>
          </Section>

          <Section title="6. Returns and Warranty">
            <p>
              Returns require prior written authorisation. Products must be returned in original condition within
              14 days of delivery. Warranty terms are as stated by the original manufacturer and are passed through
              to the buyer. NB LAO's liability is limited to the invoice value of the affected goods.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              To the fullest extent permitted by Lao law, NB LAO shall not be liable for indirect, incidental,
              or consequential damages arising from the use of this platform or the goods supplied.
            </p>
          </Section>

          <Section title="8. Governing Law">
            <p>
              These terms are governed by the laws of the Lao PDR. Any disputes shall be subject to the
              jurisdiction of courts in Vientiane, Lao PDR.
            </p>
          </Section>

          <Section title="9. Contact">
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
