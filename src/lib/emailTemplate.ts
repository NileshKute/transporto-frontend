/**
 * G K Enterprise branded email template.
 * Use for: invoice emails, payment reminders, trip notifications, automated emails.
 */
export function brandedEmailTemplate(content: string, _subject?: string): string {
  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0A1628,#0D2847);padding:24px;text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:12px;">
          <div style="background:linear-gradient(135deg,#0D2847,#1A4A7A);width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:20px;font-weight:bold;color:#fff;">G</span>
            <span style="font-size:20px;font-weight:bold;color:#42A5F5;">K</span>
          </div>
          <div style="text-align:left;">
            <div style="color:#fff;font-size:16px;font-weight:bold;letter-spacing:2px;">G K ENTERPRISE</div>
            <div style="color:#42A5F5;font-size:10px;letter-spacing:3px;">COLD CHAIN LOGISTICS</div>
          </div>
        </div>
      </div>
      <!-- Blue accent bar -->
      <div style="height:3px;background:linear-gradient(90deg,#1565C0,#42A5F5);"></div>
      <!-- Body -->
      <div style="padding:30px;background:#fff;">
        ${content}
      </div>
      <!-- Footer -->
      <div style="background:#F4F6F8;padding:20px;border-top:1px solid #E0E8F0;text-align:center;">
        <p style="color:#7A9AB8;font-size:11px;margin:0;">
          G K Enterprise | COLD CHAIN LOGISTICS | Since 2019<br>
          Shree Ganesh CHS, 402, Plot 151, Phase II, Navde, Taloja, Panvel, Maharashtra 410208<br>
          +91 9324540988 | ganesh@gkenterprise.in | www.gkenterprise.in
        </p>
      </div>
      <!-- Bottom bar -->
      <div style="height:4px;background:#0D2847;"></div>
    </div>
  `;
}
