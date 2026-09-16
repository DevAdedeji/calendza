export interface SeoLandingPageContent {
  path: string
  eyebrow: string
  metaTitle: string
  metaDescription: string
  headline: string
  intro: string
  problemTitle: string
  problemDescription: string
  benefits: Array<{ title: string, description: string, icon: string }>
  steps: Array<{ title: string, description: string }>
  useCases: string[]
  faqs: Array<{ question: string, answer: string }>
  related: Array<{ label: string, description: string, to: string }>
  ctaLabel?: string
  walkthrough?: {
    title: string
    description: string
    note: string
    scenes: Array<{
      title: string
      description: string
      screenshot?: {
        src: string
        alt: string
        width: number
        height: number
      }
    }>
  }
}

export const seoLandingPages: Record<string, SeoLandingPageContent> = {
  '/use-cases/consultants': {
    path: '/use-cases/consultants',
    eyebrow: 'Client consultations',
    metaTitle: 'Online Scheduling Software for Consultants',
    metaDescription: 'Let consulting clients book the right meeting, pay when required and receive automatic reminders with Calendza scheduling software.',
    headline: 'Book client consultations.',
    ctaLabel: 'Create your consultation link',
    walkthrough: {
      title: 'From “Can we talk?” to a booked consultation.',
      description: 'You offer a free 15-minute discovery call and a paid 60-minute advisory session. Give each its own link so clients know what they are booking.',
      note: 'Actual Calendza interface with fictional demo details. This example does not create a booking.',
      scenes: [{
        title: 'Your client sees when you are available',
        description: 'Send your discovery-call link. Your client picks an available time, answers your questions and receives a confirmation. You both have the details without another email thread.',
        screenshot: {
          src: '/images/solutions/consultation-desktop.jpg',
          alt: 'Calendza discovery-call booking page for demo consultant Ada, showing a 15-minute meeting and available times.',
          width: 1100, height: 820
        }
      }]
    },
    intro: 'Let clients choose a time for a discovery call or advisory session. Calendza checks your availability and sends the booking details.',
    problemTitle: 'Too much back-and-forth before the call?',
    problemDescription: 'Instead of exchanging possible times, share a booking link. Clients see when you are free in their own timezone.',
    benefits: [
      { title: 'One link, several meeting lengths', description: 'Offer a focused call or a longer working session from the same event type without maintaining duplicate links.', icon: 'i-lucide-timer' },
      { title: 'Charge for your time', description: 'Collect payment for paid appointments and keep the booking connected to its payment status.', icon: 'i-lucide-wallet-cards' },
      { title: 'Follow-ups that run themselves', description: 'Send confirmations, reminders and workflow emails without manually chasing every client.', icon: 'i-lucide-workflow' }
    ],
    steps: [
      { title: 'Create a consultation', description: 'Add an event type with a name, duration, meeting location and any questions for your client.' },
      { title: 'Set when you are available', description: 'Choose your working hours and connect the calendars Calendza should check for conflicts.' },
      { title: 'Share your link', description: 'Send it to a client or add it to your email signature. They choose a time and receive a confirmation.' }
    ],
    useCases: ['Independent consultants', 'Coaches and advisors', 'Freelance specialists', 'Agencies offering consultations'],
    faqs: [
      { question: 'Can clients choose between different meeting lengths?', answer: 'Yes. One event type can offer its main duration plus additional durations, so clients choose without making you manage several nearly identical links.' },
      { question: 'Can I require payment before confirming a consultation?', answer: 'Yes. Paid event types connect the reservation to its checkout so the appointment is not treated as paid until the payment provider confirms it.' },
      { question: 'Can I start on the Free plan?', answer: 'Yes. Free includes event types, calendar connections, reminders and paid bookings. Personal Pro adds branding, revenue reports and a lower fee on personal paid bookings. See Pricing for the details.' }
    ],
    related: [
      { label: 'Get paid for appointments', description: 'See how a client books and pays for a session.', to: '/use-cases/paid-appointments' },
      { label: 'Booking widget', description: 'Let clients book without leaving your website.', to: '/features/booking-widget' },
      { label: 'Explore every feature', description: 'See scheduling, analytics, workflows and integrations.', to: '/features' }
    ]
  },
  '/use-cases/small-business': {
    path: '/use-cases/small-business',
    eyebrow: 'Scheduling for small businesses',
    metaTitle: 'Appointment Scheduling for Small Businesses',
    metaDescription: 'Accept appointments online, reduce scheduling messages and coordinate staff availability with Calendza for small businesses.',
    headline: 'A simpler appointment system for a busy small business.',
    intro: 'Turn enquiries into confirmed appointments with a booking page that stays available even when nobody is free to answer the phone.',
    problemTitle: 'Keep bookings organised without adding more admin',
    problemDescription: 'Calendza brings availability, team assignment, reminders and payment status into one scheduling flow that is understandable for staff and customers.',
    benefits: [
      { title: 'Appointments around real availability', description: 'Working hours, time off, notice periods and booking limits protect the time your team needs.', icon: 'i-lucide-calendar-check-2' },
      { title: 'The right person gets the booking', description: 'Use individual, round-robin or collective team events depending on how your service is delivered.', icon: 'i-lucide-users' },
      { title: 'Fewer missed appointments', description: 'Automatic confirmations and reminders give customers the details they need before the meeting.', icon: 'i-lucide-bell-ring' }
    ],
    steps: [
      { title: 'Create your services', description: 'Set the duration, location, questions, capacity and price for each appointment customers can book.' },
      { title: 'Add your team and availability', description: 'Each person keeps their own calendar and working hours while the team controls shared booking links.' },
      { title: 'Share or embed the booking flow', description: 'Use a hosted page, direct link or website overlay wherever customers already find your business.' }
    ],
    useCases: ['Professional service firms', 'Small agencies', 'Tutors and educators', 'Appointment-based local teams'],
    faqs: [
      { question: 'Can several employees receive bookings?', answer: 'Yes. Team event types can assign one host, rotate bookings between available hosts or require several hosts for the same meeting.' },
      { question: 'Can we prevent too many bookings in one day?', answer: 'Yes. Booking limits can cap reservations per day, week or month alongside notice periods and availability rules.' },
      { question: 'Can customers book from our existing website?', answer: 'Yes. Calendza provides a booking overlay and inline embed so customers do not have to leave your site.' },
      { question: 'Can we see how the team is performing?', answer: 'Yes. Team analytics show booking activity and can be exported according to each member’s permissions.' }
    ],
    related: [
      { label: 'Team scheduling', description: 'Coordinate shared availability and assignment.', to: '/use-cases/team-scheduling' },
      { label: 'Paid appointments', description: 'Collect payment as part of booking.', to: '/use-cases/paid-appointments' },
      { label: 'Pricing', description: 'Compare personal and team plans.', to: '/pricing' }
    ]
  },
  '/use-cases/paid-appointments': {
    path: '/use-cases/paid-appointments',
    eyebrow: 'Paid appointments',
    metaTitle: 'Paid Appointment Booking Software',
    metaDescription: 'Create paid booking links, confirm appointments after payment and track refunds and settlements with Calendza.',
    headline: 'Get paid for appointments.',
    intro: 'Set a price for your session. Your client chooses a time and pays, and Calendza confirms the appointment after payment is verified.',
    problemTitle: 'Still chasing payment after booking?',
    problemDescription: 'Keep payment in the booking flow instead of sending separate payment instructions and checking who has paid.',
    ctaLabel: 'Create a paid appointment',
    walkthrough: {
      title: 'A ₦15,000 advisory session, from booking to payment.',
      description: 'A client wants your 60-minute advisory session. They see the ₦15,000 price, choose a time and continue to checkout.',
      note: 'Actual Calendza interface with fictional demo details. ₦15,000 is an example appointment price, not a Calendza subscription price. No money was charged for these screenshots.',
      scenes: [
        {
          title: 'The price is clear before checkout',
          description: 'Set the appointment price and currency in your event settings. Guests choose an available time and enter their details before continuing to payment.',
          screenshot: {
            src: '/images/solutions/paid-booking-desktop.jpg',
            alt: 'Calendza demo advisory-session booking page showing a 60-minute appointment priced at NGN 15,000.',
            width: 1100, height: 820
          }
        },
        {
          title: 'Keep the booking and payment together',
          description: 'Once payment is verified, the booking is confirmed and marked paid. The booking record keeps the appointment and its payment status together.',
          screenshot: {
            src: '/images/solutions/paid-confirmation-desktop.jpg',
            alt: 'Calendza booking details for a fictional advisory session showing a confirmed booking and a paid NGN 15,000 payment.',
            width: 1100, height: 820
          }
        }
      ]
    },
    benefits: [
      { title: 'Know who has paid', description: 'See the price, currency and payment status alongside the appointment they belong to.', icon: 'i-lucide-calendar-check' },
      { title: 'Clear financial history', description: 'Review confirmed payments, fees, settlement information, withdrawals and refund progress.', icon: 'i-lucide-receipt-text' },
      { title: 'Know when something needs attention', description: 'See unfinished payments and refund problems instead of assuming every checkout succeeded.', icon: 'i-lucide-shield-check' }
    ],
    steps: [
      { title: 'Set up payments', description: 'Open Payments and complete the Bachs account setup and any required verification for yourself or your team.' },
      { title: 'Set the appointment price', description: 'Choose a supported collection currency and show the price before a guest selects a time.' },
      { title: 'Share your booking link', description: 'Your client picks a time and pays. Calendza temporarily holds the slot during checkout and confirms it after payment is verified.' }
    ],
    useCases: ['Paid consultations', 'Coaching sessions', 'Classes and workshops', 'Professional advisory calls'],
    faqs: [
      { question: 'Which currencies can I price appointments in?', answer: 'Paid event types support Nigerian naira (NGN) and US dollars (USD). You choose the appointment currency in the event settings; it is separate from the currency used for your Calendza subscription.' },
      { question: 'Do I need a paid plan, and are there fees?', answer: 'Paid bookings are available on Free with a 5% platform fee. Personal Pro lowers the fee on personal paid bookings to 2.5%; team paid bookings use 5%. Payment-provider fees are separate. Complete the Bachs setup and required verification before collecting payments.' },
      { question: 'What if the client does not finish paying?', answer: 'The appointment is confirmed only after payment is verified. An unpaid slot hold expires so someone else can book the time.' },
      { question: 'When will the money reach my bank?', answer: 'Not immediately after a booking is paid. Funds first settle with Bachs. Once funds are available and your payout destination is approved, you can request a withdrawal. Processing time and any currency conversion depend on the provider and destination.' }
    ],
    related: [
      { label: 'Book client consultations', description: 'Start with a discovery call or advisory session.', to: '/use-cases/consultants' },
      { label: 'Schedule as a team', description: 'Let clients book the right available teammate.', to: '/use-cases/team-scheduling' },
      { label: 'Pricing', description: 'Compare plans and paid-booking fees.', to: '/pricing' }
    ]
  },
  '/use-cases/team-scheduling': {
    path: '/use-cases/team-scheduling',
    eyebrow: 'Team scheduling software',
    metaTitle: 'Round-Robin and Team Scheduling Software',
    metaDescription: 'Distribute meetings with round-robin scheduling, coordinate collective events and manage team booking links with Calendza.',
    headline: 'Schedule as a team.',
    ctaLabel: 'Set up team scheduling',
    walkthrough: {
      title: 'One teammate, or everyone together?',
      description: 'A sales call needs one available teammate. A panel interview needs everyone together. Here is how the same team can offer both.',
      note: 'Actual Calendza interface with a fictional demo team. Example meetings are not live booking links.',
      scenes: [
        {
          title: 'Round robin: one available teammate',
          description: 'Three salespeople share a discovery-call link. A client picks a time and Calendza assigns an available host. This is called round-robin scheduling.',
          screenshot: {
            src: '/images/solutions/team-setup-desktop.jpg',
            alt: 'Calendza demo team event settings showing round-robin scheduling and three selected hosts.',
            width: 1100, height: 820
          }
        },
        {
          title: 'Collective: everyone needed for the meeting',
          description: 'An interview needs two panel members. Calendza only offers times when both can attend. This is called collective scheduling.',
          screenshot: {
            src: '/images/solutions/team-booking-desktop.jpg',
            alt: 'Calendza demo team interview booking page showing times available for a collective meeting.',
            width: 1100, height: 820
          }
        }
      ]
    },
    intro: 'Give customers one booking link, whether they need any available teammate or several people in the same meeting.',
    problemTitle: 'Whose calendar should the customer use?',
    problemDescription: 'They do not need to choose. A shared link checks the hosts’ availability and offers the right times for that meeting.',
    benefits: [
      { title: 'Round-robin distribution', description: 'Offer times from available team members and distribute new meetings through a fair assignment flow.', icon: 'i-lucide-refresh-cw' },
      { title: 'Collective meetings', description: 'Find a time when every required host is free for panels, onboarding or multi-person calls.', icon: 'i-lucide-users-round' },
      { title: 'Managed event templates', description: 'Give selected members consistent booking links while allowing controlled personalisation.', icon: 'i-lucide-layout-template' }
    ],
    steps: [
      { title: 'Invite your teammates', description: 'Create a team. Each host sets availability and connects the calendars to check for conflicts.' },
      { title: 'Create a shared event', description: 'Choose round robin for one available host, or collective for everyone who must attend.' },
      { title: 'Share the team link', description: 'Customers choose a time without comparing calendars. The assigned hosts receive the booking details.' }
    ],
    useCases: ['Sales and discovery teams', 'Customer onboarding', 'Recruiting panels', 'Agencies with shared services'],
    faqs: [
      { question: 'Do team members lose their personal booking pages?', answer: 'No. Team membership and personal scheduling are separate. A member can keep personal event types while also hosting team event types.' },
      { question: 'Can team administrators standardise event types?', answer: 'Yes. Managed templates can create consistent member links and keep administrator-controlled fields synchronised.' },
      { question: 'Which plan do we need?', answer: 'Shared team scheduling uses a Team subscription, with a trial available. Personal Pro alone does not provide a team workspace subscription. See Pricing for current regional prices and billing options.' }
    ],
    related: [
      { label: 'Book client consultations', description: 'See the booking flow for individual client calls.', to: '/use-cases/consultants' },
      { label: 'Booking widget', description: 'Embed team booking into your website.', to: '/features/booking-widget' },
      { label: 'Explore every feature', description: 'See workflows, routing, analytics and more.', to: '/features' }
    ]
  },
  '/features/booking-widget': {
    path: '/features/booking-widget',
    eyebrow: 'Embeddable booking widget',
    metaTitle: 'Booking Widget for Your Website',
    metaDescription: 'Add a responsive scheduling widget to your website with timezone-aware availability and a clear Calendza booking flow.',
    headline: 'Let visitors book without leaving your website.',
    intro: 'Turn any button or section into a booking experience that opens directly on your site and stays connected to your Calendza availability.',
    problemTitle: 'Fewer steps between interest and a confirmed time',
    problemDescription: 'A visitor can choose an event, see available times in the correct timezone and finish booking without being sent through an unfamiliar series of pages.',
    benefits: [
      { title: 'Overlay or inline booking', description: 'Open Calendza from a call-to-action or place the booking flow directly inside a page.', icon: 'i-lucide-panels-top-left' },
      { title: 'Responsive by default', description: 'The booking experience adapts to the available space across phones, tablets and desktop screens.', icon: 'i-lucide-monitor-smartphone' },
      { title: 'One source of availability', description: 'Embedded bookings use the same event settings, connected calendars and booking rules as your hosted page.', icon: 'i-lucide-calendar-sync' }
    ],
    steps: [
      { title: 'Choose an event type', description: 'Use the personal or team event that visitors should be able to book.' },
      { title: 'Copy the embed snippet', description: 'Add the generated script and button or inline container to your website.' },
      { title: 'Keep managing everything in Calendza', description: 'Changes to availability and event settings automatically apply to the embedded experience.' }
    ],
    useCases: ['Portfolio contact pages', 'Consulting websites', 'Agency service pages', 'Product demo pages'],
    faqs: [
      { question: 'Does the widget work on mobile?', answer: 'Yes. The embedded booking interface is responsive and designed to fit smaller screens as well as desktop layouts.' },
      { question: 'Do I need to maintain separate availability for the widget?', answer: 'No. The widget reads the same Calendza event type and availability used by the hosted booking page.' },
      { question: 'Can I open booking from an existing button?', answer: 'Yes. The overlay option can attach the booking experience to a call-to-action instead of occupying permanent space on the page.' },
      { question: 'Will visitors see times in their timezone?', answer: 'Yes. The booking flow presents availability using the guest’s selected timezone while preserving the host’s scheduling rules.' }
    ],
    related: [
      { label: 'Consultant scheduling', description: 'Make consultation pages easier to convert.', to: '/use-cases/consultants' },
      { label: 'Team scheduling', description: 'Embed a shared team booking flow.', to: '/use-cases/team-scheduling' },
      { label: 'All Calendza features', description: 'Explore everything around the booking widget.', to: '/features' }
    ]
  },
  '/compare/calendly-alternative': {
    path: '/compare/calendly-alternative',
    eyebrow: 'Calendly alternative',
    metaTitle: 'Calendly Alternative for Flexible Scheduling',
    metaDescription: 'Looking for a Calendly alternative? Explore Calendza booking pages, multiple durations, workflows, routing, team scheduling and paid appointments.',
    headline: 'A Calendly alternative built to stay clear as you grow.',
    intro: 'Start with a straightforward personal booking link, then add payments, routing, workflows or team scheduling when your process genuinely needs them.',
    problemTitle: 'Powerful scheduling should still feel understandable',
    problemDescription: 'Calendza keeps personal and team subscriptions separate, uses focused forms and gives advanced features a clear place instead of crowding the basic booking flow.',
    benefits: [
      { title: 'Flexible personal scheduling', description: 'Use multiple durations, recurring bookings, booking limits, time off and private one-use meeting links.', icon: 'i-lucide-calendar-range' },
      { title: 'Automation without losing control', description: 'Build booking workflows and routing forms while keeping the guest experience focused.', icon: 'i-lucide-workflow' },
      { title: 'Teams when you actually need them', description: 'Add round robin, collective scheduling, team analytics and managed templates separately from personal Pro.', icon: 'i-lucide-users' }
    ],
    steps: [
      { title: 'Create your personal booking page', description: 'Set your availability and publish the meeting types people should be able to choose.' },
      { title: 'Connect the tools around the meeting', description: 'Add calendars, video conferencing, reminders, workflows or payment according to your process.' },
      { title: 'Expand without rebuilding', description: 'Keep personal scheduling while creating a separate team workspace when collaboration becomes necessary.' }
    ],
    useCases: ['People replacing scattered booking links', 'Consultants who need paid sessions', 'Teams that need host assignment', 'Businesses embedding scheduling on their site'],
    faqs: [
      { question: 'Can I use Calendza for personal scheduling without creating a team?', answer: 'Yes. Personal scheduling is a complete product on its own; a team workspace is only needed for shared ownership, host assignment and team administration.' },
      { question: 'Can one event type offer multiple durations?', answer: 'Yes. Guests can choose from the durations you enable on one event type instead of navigating several duplicate links.' },
      { question: 'Does Calendza support workflows and routing forms?', answer: 'Yes. Routing forms direct a guest to the appropriate event, while workflows automate messages and follow-up around booking activity.' },
      { question: 'Can I keep a personal plan while joining or creating a team?', answer: 'Yes. Personal Pro and team billing represent different benefits, so team membership does not silently replace a user’s personal subscription.' }
    ],
    related: [
      { label: 'All features', description: 'Review the complete Calendza feature set.', to: '/features' },
      { label: 'Team scheduling', description: 'Compare shared scheduling modes.', to: '/use-cases/team-scheduling' },
      { label: 'Pricing', description: 'See personal and team plan options.', to: '/pricing' }
    ]
  }
}
