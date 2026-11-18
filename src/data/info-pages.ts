import type { InfoPage } from "./site-content";
import { BRAND } from "@/lib/brand";

/*
 * Company and resource pages shown at /info/<slug>. A footer link opens /info/<slugify(label)>,
 * so every label in footerSections (data/news.ts) needs a key here or in legal-pages.ts.
 */
const E = BRAND.emails;

export const companyPages: Record<string, InfoPage> = {
  "about-us": {
    title: "About Hodii",
    text: `In Swahili, “hodi!” is what you call at a door before you step in. ${BRAND.name} is Kenya's property marketplace: a place to find a home, a plot or a commercial space, and to deal with people who are who they say they are.`,
    facts: [
      { label: "Based in", value: "Nairobi, Kenya" },
      { label: "Listings", value: "Sale · Rent · Land · Commercial" },
      { label: "Listed by", value: "Agencies, developers and owners" },
    ],
    sections: [
      {
        heading: "Why we exist",
        body: [
          "Finding a place in Kenya still means too many phone calls, out-of-date adverts and photos that do not match the house. Good listings are scattered across social media, notice boards and agents' contact lists, and scams take advantage of the gaps.",
          "Hodii brings listings into one place and holds them to a standard: real photos, clear prices, an exact location and an agency that stands behind each one.",
        ],
      },
      {
        heading: "What we stand for",
        bullets: [
          "Trust — every listing belongs to a named agency or owner, and we remove those that mislead.",
          "Clarity — price, size, location and features are stated plainly, in Kenya shillings.",
          "Fairness — buyers, tenants, landlords and agents all get a straight deal.",
          "Safety — we publish fraud guidance and make it easy to report a listing.",
          "Respect for your data — we ask for what we need and say what we do with it.",
        ],
      },
      {
        heading: "How Hodii works",
        body: [
          "Agencies and property owners create an account, publish listings and receive enquiries from people looking for a place. Buyers and renters browse and search for free, save the homes they like and contact the lister directly.",
          "Hodii is a marketplace. We are not a party to any sale or tenancy, and we never ask you to pay rent, a deposit or a purchase price through us.",
        ],
      },
    ],
  },
  "listing-standards": {
    title: "Listing standards",
    text: "Every listing on Hodii must be accurate, current and honest. This page sets out what listers agree to when they publish, and what everyone can expect from us when a listing falls short.",
    sections: [
      {
        heading: "Who can list",
        bullets: [
          "Estate agencies and property managers, who must be registered as the law requires (in Kenya, with the Estate Agents Registration Board) and can show it.",
          "Developers marketing their own projects.",
          "Owners and landlords listing their own property.",
          "Every listing is published under a named agency or owner account, never anonymously.",
        ],
      },
      {
        heading: "What every listing must include",
        bullets: [
          "A clear title and a description of the property that is accurate and not copied from another lister.",
          "At least one clear, real photograph of the actual property; several are strongly encouraged.",
          "Whether it is for sale or to rent, the asking price in Kenya shillings and, for rentals, the payment period and any deposit.",
          "The county and area, with an accurate location pin.",
          "The property type and its main details: bedrooms, bathrooms, size and key features where they apply.",
        ],
      },
      {
        heading: "What is not allowed",
        bullets: [
          "Properties that do not exist, are not available, or that the lister has no authority to sell or let.",
          "Photos, prices or details that are misleading, or that belong to a different property.",
          "Duplicate listings of the same property by the same lister.",
          "Fees for viewings, “booking” or “registration” before a tenant or buyer has seen the property.",
          "Discriminatory wording, offensive content, or personal details of other people.",
        ],
      },
      {
        heading: "Keeping listings fresh",
        body: [
          "Listers must mark a property as let or sold promptly. We may ask a lister to confirm that a listing is still available, and listings that are not confirmed can be hidden.",
        ],
      },
      {
        heading: "Verification and enforcement",
        body: [
          "We review reported listings and may check them against the information a lister has given us. Where a listing breaks these standards we may ask for changes, hide or remove it, or suspend the account behind it. Repeated or serious breaches, and anything that looks like fraud, lead to permanent removal and, where appropriate, a report to the authorities.",
          `To report a listing, use the report option on the listing page or write to ${E.report}.`,
        ],
      },
    ],
  },
  "list-with-hodii": {
    title: "List with Hodii",
    text: "Reach people who are actively looking for a place. Agencies, developers and owners can publish listings, manage enquiries and track how their properties perform.",
    sections: [
      {
        heading: "For agencies and developers",
        bullets: [
          "Publish listings under your agency name, with your logo, contact details and registration information.",
          "Manage all your listings, photos and enquiries from one agency dashboard.",
          "Invite colleagues to manage listings under the same agency.",
          "See how many people view, save and enquire about each property.",
        ],
      },
      {
        heading: "For owners and landlords",
        bullets: [
          "Create a free account and list a property you own, for sale or to rent.",
          "Upgrade to an agency account later if you start managing property for others.",
        ],
      },
      {
        heading: "How to start",
        body: [
          "Create an account, choose whether you are listing as an individual or an agency, and add your first property. We may ask for proof of registration or ownership before a listing goes live.",
          `Questions about listing? Write to ${E.agents} and we will reply within two working days.`,
        ],
      },
    ],
  },
  careers: {
    title: "Careers at Hodii",
    text: "We are building the property platform Kenya deserves. We are always glad to hear from engineers, designers, data people and property professionals who care about getting this right.",
    sections: [
      {
        heading: "What it is like here",
        body: [
          "A small team solving a real problem: making it easier and safer to find a place to live or do business. You will have room to own your work, and people who will help you do it well.",
        ],
      },
      {
        heading: "Open roles",
        body: ["We don't have any open roles listed at the moment. New positions will appear here when they open."],
      },
      {
        heading: "How we hire",
        body: [
          "A written application, a conversation with the team, a short practical exercise relevant to the role and a final conversation. You will hear from us at every stage.",
          `To get in touch, send your CV and a short note about work you are proud of to ${E.business}.`,
        ],
      },
    ],
  },
  "press-room": {
    title: "Press room",
    text: "Information about Hodii, our brand assets and how to reach us. For interviews, data requests and partnerships, this is the place to start.",
    sections: [
      {
        heading: "Media contacts",
        bullets: [`Press enquiries, interview requests and partnerships — ${E.business} (answered within one working day)`],
      },
      {
        heading: "About Hodii",
        body: [
          `${BRAND.name} is a Kenyan property marketplace where verified agencies, developers and owners list homes, land and commercial space for sale and to rent. Our goal is to make finding a place clearer, faster and safer.`,
        ],
      },
      {
        heading: "Brand assets",
        body: [
          "Our press kit includes the Hodii wordmark and logo in light and dark variants. Assets may be used for editorial coverage of Hodii with attribution; commercial use requires written permission.",
        ],
      },
    ],
  },
  "contact-us": {
    title: "Contact us",
    text: "Whether you are searching for a home, listing a property or just have a question, here is how to reach the right people.",
    sections: [
      {
        heading: "Property seekers",
        bullets: [
          `Questions about using Hodii, or help with your account — ${E.support}`,
          "To ask about a specific property, use the enquiry form on that listing: it goes straight to the lister.",
        ],
      },
      {
        heading: "Agencies, developers and owners",
        bullets: [`Listing help, agency accounts and verification — ${E.agents}`],
      },
      {
        heading: "Safety and reports",
        bullets: [
          `Report a suspicious or misleading listing — ${E.report}, with a link to the listing and what concerns you`,
          `Privacy and data requests — ${E.privacy}`,
          `Legal notices — ${E.legal}`,
        ],
      },
      {
        heading: "Business",
        bullets: [`Advertising, partnerships and press — ${E.business}`, `General questions and feedback — ${E.general}`],
      },
      {
        heading: "Our office",
        body: [
          BRAND.address,
          "We answer every message within two working days. Urgent safety matters are prioritised immediately.",
        ],
      },
    ],
  },
  advertise: {
    title: "Advertise with Hodii",
    text: "Put your development, agency or service in front of people who are actively looking for a place. Every placement is clearly labelled and never mixed up with ordinary listings.",
    facts: [
      { label: "Audience", value: "Buyers, renters and investors" },
      { label: "Market", value: "Kenya" },
    ],
    sections: [
      {
        heading: "Who advertises with us",
        body: [
          "Developers launching a new project, agencies building a name, and businesses that serve people who are moving: mortgage and SACCO lenders, removals, furniture, legal and surveying services, and more.",
        ],
      },
      {
        heading: "Formats",
        bullets: [
          "Boosted listings, bought for the number of days you choose, and Premium packages for agencies with many listings. Both are labelled and both lift a listing in search and on the home page.",
          "Development showcases for new projects, with their own page.",
          "Agency profile promotion across the site.",
          "Display placements alongside search results and guides.",
        ],
      },
      {
        heading: "Our principles",
        bullets: [
          "Every paid placement is labelled as such.",
          "Search results are ranked first by how well they match what the person asked for. Boosted and Premium listings get a limited lift, and only a minority of any results page can be paid listings.",
          "We decline advertising that is misleading or illegal, and we do not accept advertising for unregistered agents.",
        ],
      },
      {
        heading: "Working with us",
        body: [`Write to ${E.business} with a short note about your organisation and goals, and we will respond within two working days.`],
      },
    ],
  },
};

export const resourcePages: Record<string, InfoPage> = {
  "buying-guide": {
    title: "Buying guide",
    text: "A practical path for buying a home or land in Kenya. This is general information, not legal advice: always have an advocate act for you on a purchase.",
    sections: [
      {
        heading: "1. Set your budget",
        body: [
          "Your budget is more than the asking price. Allow for legal fees, stamp duty, valuation, search and registration costs, and moving. If you are borrowing, ask a bank or SACCO what they will lend before you start viewing.",
        ],
      },
      {
        heading: "2. Shortlist and view",
        bullets: [
          "Use filters for location, price, bedrooms and property type, then save the homes you like.",
          "Visit in person, at different times of day, and look at water, drainage, security, road access and the neighbourhood.",
          "Never pay anything to “reserve” a property before you have seen it and checked it.",
        ],
      },
      {
        heading: "3. Check the paperwork",
        bullets: [
          "Have your advocate carry out an official search at the land registry to confirm the registered owner and whether the title has any charges, caveats or restrictions.",
          "Confirm that the seller is the registered owner, or has proper authority to sell.",
          "For apartments, ask about the type of title (for example sectional title), service charges and the management company.",
          "For new developments, ask for the relevant county and environmental approvals.",
          "Visit the plot or property to confirm that it matches the title and survey plan.",
        ],
      },
      {
        heading: "4. Agree and complete",
        body: [
          "Your advocate prepares or reviews the sale agreement, handles payment through proper channels, pays the applicable taxes and registers the transfer. Pay purchase money only as your advocate instructs, to the seller's advocate or an escrow arrangement, never to an agent's personal phone number.",
        ],
      },
      {
        heading: "If you are not a Kenyan citizen",
        body: [
          "Rules on land ownership differ for non-citizens, who may generally hold leasehold rather than freehold interests. Speak to an advocate about what applies to you before you commit.",
        ],
      },
    ],
  },
  "renting-guide": {
    title: "Renting guide",
    text: "How to rent a home or commercial space in Kenya with fewer surprises. General information only, not legal advice.",
    sections: [
      {
        heading: "Before you view",
        bullets: [
          "Decide your budget, including the deposit and the first rent payment, which are usually due together.",
          "Ask what is included in the rent and what is not: water, electricity, service charge, garbage and security.",
          "Check the location against your commute, schools, transport and security.",
        ],
      },
      {
        heading: "At the viewing",
        bullets: [
          "Meet the agent or landlord at the property, in daylight, and tell someone where you are going.",
          "Test taps, sockets, locks, windows and water pressure. Ask about water supply and power backups.",
          "Take photos and write down any existing damage so it is recorded before you move in.",
        ],
      },
      {
        heading: "Before you pay",
        bullets: [
          "Confirm that the person you are dealing with is the landlord or a registered agent acting for the landlord.",
          "Never pay a “viewing”, “booking” or “registration” fee before you have seen the property.",
          "Pay deposits and rent only against a written receipt, and to the account named in the tenancy agreement.",
        ],
      },
      {
        heading: "The tenancy agreement",
        body: [
          "Read it before you sign. It should state the rent, the payment date, the deposit and how it is refunded, who pays which bills, the notice period for either side, and the rules for repairs. Keep a signed copy and your receipts.",
        ],
      },
      {
        heading: "If there is a dispute",
        body: [
          "Start by raising the problem in writing with your landlord or agent. If it is not resolved, seek advice from an advocate or the relevant rent tribunal or court.",
        ],
      },
    ],
  },
  "selling-and-letting": {
    title: "Selling and letting guide",
    text: "How to market a property well and deal with enquiries on Hodii, whether you are an agency or an owner.",
    sections: [
      {
        heading: "Create a strong listing",
        bullets: [
          "Use a precise title that says what the property is and where: for example, “3-bedroom apartment in Kilimani”.",
          "Upload several clear photos in good daylight: the exterior, living areas, kitchen, bedrooms, bathrooms and any outdoor space.",
          "Set an honest price. Listings that are priced realistically attract more serious enquiries.",
          "Describe what makes the property stand out, and what is nearby.",
          "List the features accurately: parking, security, water supply, backup power, internet and so on.",
        ],
      },
      {
        heading: "Handle enquiries",
        bullets: [
          "Reply promptly: most people contact several listers at once.",
          "Meet people at the property, and never ask for money before a viewing.",
          "Be clear about fees, deposits and the documents a buyer or tenant will need.",
        ],
      },
      {
        heading: "Stay compliant",
        body: [
          "Agencies must be properly registered. Landlords remain responsible for their own tax obligations on rental income and for a lawful tenancy agreement. If you are unsure, ask an advocate or a tax adviser.",
        ],
      },
      {
        heading: "Keep it current",
        body: ["Mark the property as let or sold as soon as that happens. Up-to-date listings build trust, and out-of-date ones can be hidden."],
      },
    ],
  },
  "safety-and-fraud": {
    title: "Safety and fraud",
    text: "Property scams are common, and they all follow the same patterns. Knowing them is the best protection.",
    sections: [
      {
        heading: "Warning signs",
        bullets: [
          "A price far below the market for the area.",
          "Pressure to pay quickly because “many people are interested”.",
          "A request to pay a viewing, booking or registration fee, or a deposit, before you have seen the property.",
          "A lister who cannot meet you at the property, or who says they are abroad and will send keys.",
          "Photos that look like they come from elsewhere, or a location that is vague.",
          "Requests to pay by M-Pesa or bank transfer to a personal number or an account that does not match the lister.",
        ],
      },
      {
        heading: "How to protect yourself",
        bullets: [
          "Always view in person before paying anything.",
          "Confirm who owns the property and that the lister has authority to deal with it.",
          "For purchases, use an advocate and make payments only as they instruct.",
          "Get receipts and written agreements for every payment.",
          "Meet in daylight, bring someone with you, and tell a friend where you are going.",
        ],
      },
      {
        heading: "What Hodii does and does not do",
        body: [
          "We review reported listings and remove those that break our standards. Hodii does not collect rent, deposits or purchase money, and we will never ask you to send money to us for a property.",
        ],
      },
      {
        heading: "Report a problem",
        body: [
          `Use the report option on any listing, or write to ${E.report}. If you have lost money, also report it to the police and to the Directorate of Criminal Investigations.`,
        ],
      },
    ],
  },
  "report-a-listing": {
    title: "Report a listing",
    text: "Help us keep Hodii trustworthy. If a listing looks misleading, out of date or fraudulent, tell us.",
    sections: [
      {
        heading: "What to report",
        bullets: [
          "A property that does not exist, or is not available any more.",
          "Photos, prices or details that do not match the property.",
          "A lister who asks for money before a viewing.",
          "Duplicate or discriminatory listings, or listings that contain someone's private information.",
        ],
      },
      {
        heading: "How to report",
        body: [
          `Use the report option on the listing page, or write to ${E.report} with a link to the listing and a short description of the problem. We review every report and may contact you for more information.`,
        ],
      },
    ],
  },
};
