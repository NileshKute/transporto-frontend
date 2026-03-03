# TASK: WhatsApp Integration with Twilio for Driver Communication

## What I Need
Build a complete WhatsApp integration using Twilio API so that:
1. Drivers can send messages via WhatsApp to a business number
2. The system automatically parses driver messages (trip updates, fuel entries, location updates, emergencies)
3. Admins/Managers can view all WhatsApp messages in the dashboard
4. The system can send automated replies and notifications to drivers

## Business Context
This is for an Indian transport business. Drivers are on the road across North India and many are not tech-savvy. WhatsApp is the most natural communication tool for them. They should be able to:
- Report trip start/end by sending a simple message like "Trip start Delhi to Jaipur DL01AB1234"
- Report fuel filling: "Fuel 80L ₹7200 HP Pump NH48"
- Report emergencies: "Emergency breakdown near Mathura DL01AB1234"
- Report location updates: "Reached Agra"
- The system should parse these messages and create corresponding database entries automatically

## Technical Requirements

### Backend (NestJS — already has a WhatsApp module at src/modules/whatsapp/)
1. **Twilio WhatsApp Sandbox Setup:**
   - Use Twilio API for WhatsApp Business
   - Create a webhook endpoint: POST /api/whatsapp/webhook (already exists, needs Twilio integration)
   - Verify Twilio webhook signature for security

2. **Message Parsing Engine:**
   - Parse incoming WhatsApp messages using keyword detection and NLP-lite patterns
   - Supported message types:
     - TRIP_START: "trip start [origin] to [destination] [vehicle_reg]"
     - TRIP_END: "trip end [vehicle_reg] [km_reading]"
     - FUEL: "fuel [liters]L ₹[amount] [station_name]"
     - EMERGENCY: "emergency [type] [location] [vehicle_reg]"
     - LOCATION: "location [place_name]" or "reached [place_name]"
     - GENERAL: any other message
   - Store raw message + parsed data + confidence score in database

3. **Auto-Response System:**
   - Send confirmation reply after parsing: "✅ Trip TRP-20260303-001 started: Delhi → Jaipur (DL01AB1234)"
   - Send error reply if parsing fails: "❌ Could not understand. Try: 'trip start Delhi to Jaipur DL01AB1234'"
   - Send daily summary to drivers: trips completed, fuel entries, shift hours

4. **Notification System (Outbound):**
   - Send alerts to drivers: maintenance due, insurance expiring, shift reminders
   - Send alerts to admins: emergency reported, cold storage temperature alert
   - Use Twilio WhatsApp message templates for outbound notifications

5. **Database Changes (Prisma):**
   - Update WhatsAppMessage model to include: twilioMessageSid, twilioStatus, direction (INBOUND/OUTBOUND), parsedType, parsedData (JSON), confidenceScore, autoReplyText
   - Add WhatsAppTemplate model for message templates

### Frontend (Next.js — page already exists at /whatsapp)
1. **Enhanced WhatsApp Dashboard:**
   - Real-time message feed (polling every 30 seconds)
   - Filter by: driver, message type, date range, parsed/unparsed
   - Message detail view: show raw message, parsed data, confidence, auto-reply sent
   - Manual action buttons: "Create Trip", "Create Fuel Entry" from parsed data
   - Stats cards: Total messages today, Parsed successfully %, Pending review

2. **Template Management:**
   - CRUD for WhatsApp message templates
   - Preview template with variable substitution
   - Send test message

3. **Driver Communication Panel:**
   - Select a driver → see full chat history
   - Send manual message to driver
   - Quick reply buttons: "Confirm received", "Send location", "Call office"

### Environment Variables Needed
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_WEBHOOK_URL=https://transporto-api.onrender.com/api/whatsapp/webhook
```

### API Endpoints to Create/Update
- POST /api/whatsapp/webhook — Twilio incoming webhook (update existing)
- POST /api/whatsapp/send — Send outbound message
- GET /api/whatsapp — List messages (update with filters)
- GET /api/whatsapp/:id — Message detail
- POST /api/whatsapp/templates — Create template
- GET /api/whatsapp/templates — List templates
- POST /api/whatsapp/test-send — Send test message

### Deployment Notes
- Backend is deployed on Render.com: https://transporto-api.onrender.com
- Frontend is deployed on Vercel: https://transporto-frontend.vercel.app
- Add Twilio env vars to Render dashboard after implementation
- Twilio WhatsApp sandbox is free for development/testing
- For production, apply for Twilio WhatsApp Business Profile

## Step-by-Step Implementation Order
1. Sign up for Twilio (free trial) → get Account SID, Auth Token
2. Set up Twilio WhatsApp Sandbox (join sandbox from phone)
3. Update Prisma schema with new WhatsApp fields
4. Build message parsing engine in backend
5. Update webhook endpoint to receive and parse Twilio messages
6. Build auto-reply system
7. Build outbound message sending
8. Update frontend WhatsApp page with enhanced UI
9. Test end-to-end: send WhatsApp → webhook → parse → auto-reply
10. Deploy and add env vars to Render

## Login Credentials for Testing
```
Super Admin: admin@transporto.in / admin123
Manager: priya@transporto.in / admin123
Driver: rajesh@transporto.in / driver123
```

## Live URLs
```
Backend API: https://transporto-api.onrender.com
Frontend: https://transporto-frontend.vercel.app
Swagger Docs: https://transporto-api.onrender.com/api/docs
GitHub Backend: https://github.com/NileshKute/transporto-api
GitHub Frontend: https://github.com/NileshKute/transporto-frontend
```
