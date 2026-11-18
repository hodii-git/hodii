import type { InfoPage } from "./site-content";
import { BRAND, LEGAL_UPDATED } from "@/lib/brand";

/*
 * Help, account and legal pages shown at /info/<slug>.
 * These are written for Kenya (Data Protection Act, 2019; Computer Misuse and Cybercrimes Act, 2018;
 * Consumer Protection Act, 2012; Estate Agents Act). They are a solid starting point, but must be
 * reviewed by a Kenyan advocate before launch.
 */
const UPDATED = `Last updated: ${LEGAL_UPDATED}`;
const E = BRAND.emails;
const CO = `${BRAND.legalName} (“${BRAND.name}”, “we”, “us”)`;

const privacy: InfoPage = {
  title: "Privacy policy",
  text: `We collect what we need to run a property marketplace, we never sell your personal data, and we tell you what we store and why. ${UPDATED}.`,
  sections: [
    {
      heading: "Who we are",
      body: [
        `This policy explains how ${CO} handles personal data when you use ${BRAND.domain} and related services (the “Service”). ${BRAND.legalName} is the data controller for the personal data described here, under the Data Protection Act, 2019 of Kenya.`,
        `Questions about this policy or your data can be sent to ${E.privacy}.`,
      ],
    },
    {
      heading: "Information you give us",
      bullets: [
        "Account details — your email address, username and a password (stored only in hashed form; we cannot see it).",
        "Agency and lister details — if you list property: your name or agency name, phone number, business email, registration information and the content of your listings, including photographs.",
        "Enquiries and messages — details you send to a lister through Hodii, and anything you send us for support, reports or feedback.",
        "Saved items and activity — properties you save, searches and alerts you create while signed in.",
        "Profile picture and public profile — if you add a picture, or an agency adds a logo, cover image, story and team details, these are shown publicly on your profile or agency page.",
        "Reviews and comments — reviews you write about an agency and comments on listings. They are shown with your username and can be seen by anyone.",
        "Conversations — replies you exchange with an agency about an enquiry, inside your Hodii account.",
        "Payment details — when an agency pays to boost a listing or buy a Premium package through M-Pesa, we record the amount, the phone number used, the M-Pesa receipt number and the time. We never see or store your M-Pesa PIN.",
        "Recovery codes — if you create them, we store only a one-way hash of each code so that you can regain access if you lose your password. We cannot read them.",
      ],
    },
    {
      heading: "Information collected automatically",
      bullets: [
        "Usage statistics — the pages you visit, the referring site, the type of device and the time of the visit, linked to a random identifier in your browser rather than your name.",
        "Analytics — we use Google Analytics to understand how the Service is used in aggregate. Google processes that data under its own privacy policy.",
        "Security data — a one-way hash of your network address is used to limit abuse such as repeated sign-up attempts, repeated recovery attempts, automated attacks and excessive revealing of phone numbers.",
        "Map search — when you search by drawing an area on the map, the area is used only to run that search. We do not keep your location unless you save the search.",
      ],
    },
    {
      heading: "How we use personal data",
      bullets: [
        "To provide the Service — running your account, publishing listings and passing your enquiries to the lister you contacted.",
        "To keep the Service trustworthy — checking listings, preventing fraud, spam and abuse, and enforcing our terms.",
        "To improve the Service — understanding which features and listings people use.",
        "To communicate with you — replying to your messages and telling you about important changes.",
        "To meet legal obligations — where the law requires us to keep or disclose information.",
      ],
    },
    {
      heading: "Our lawful bases",
      body: [
        "We process personal data where it is necessary to perform our contract with you (running your account and listings), where we have a legitimate interest that is not outweighed by your rights (security, fraud prevention and improving the Service), where the law requires it, or where you have given consent. Where we rely on consent, you can withdraw it at any time.",
      ],
    },
    {
      heading: "Who we share data with",
      body: [
        "We never sell your personal data. When you send an enquiry about a property, we pass your name and the contact details you provided to the lister, so that they can reply. Contact details that listers publish on a listing are visible to anyone who views it.",
        "We also share data with service providers who help us run the Service, such as hosting, database, authentication and analytics providers, under contracts that require them to protect it and use it only on our instructions. We may disclose data to the police, courts or regulators where the law requires, or to protect people from fraud or harm.",
      ],
    },
    {
      heading: "Transfers outside Kenya",
      body: [
        "Some of our providers process data outside Kenya. Where that happens, we take steps to make sure the data stays protected, as the Data Protection Act requires.",
      ],
    },
    {
      heading: "How long we keep data",
      bullets: [
        "Account and listing data — for as long as your account is open. When you delete your account we delete or anonymise it within 30 days, except where we must keep it for legal reasons.",
        "Enquiries and the replies on them — up to 24 months, so that listers and seekers can follow up.",
        "Payment records — up to 7 years, because tax and accounting rules require us to keep them.",
        "Reviews — until you delete them or your account. When you delete your account your reviews are deleted too.",
        "Usage statistics — up to 24 months, then deleted or aggregated.",
        "Security records — up to 12 months.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        `Under the Data Protection Act, 2019 you have the right to be informed about how we use your data, to access it, to object to its processing, to have inaccurate data corrected, to have it deleted where appropriate, and to receive a copy of data you gave us. You can download a copy of your data from your profile settings. To use any of these rights, write to ${E.privacy} from the email address on your account. We respond within the time the law allows.`,
        "You also have the right to complain to the Office of the Data Protection Commissioner of Kenya (ODPC).",
      ],
    },
    {
      heading: "Security",
      body: [
        "We use encryption in transit, hashed passwords, access controls and monitoring to protect your data. No system is perfectly secure. If a breach affects you, we will tell you and the ODPC as the law requires.",
      ],
    },
    {
      heading: "Children",
      body: [
        "The Service is for people aged 18 and over. We do not knowingly collect personal data from children. If you believe a child has given us data, contact us and we will delete it.",
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "We may update this policy from time to time. The date at the top shows when it last changed. For significant changes we will give notice on the Service before they take effect.",
      ],
    },
  ],
};

const cookies: InfoPage = {
  title: "Cookie policy",
  text: `What we store in your browser, and why. ${UPDATED}.`,
  sections: [
    {
      heading: "Our approach",
      body: [
        "We do not use advertising cookies. The Service keeps a small amount of information in your browser, using cookies or local storage, so that it works properly.",
      ],
    },
    {
      heading: "What we store",
      bullets: [
        "Essential — keeps you signed in, protects against abuse and remembers choices such as light or dark mode. These are required for the Service to work.",
        "Usage — a random identifier so we can count visits and see which pages are used, without identifying you.",
        "Analytics — Google Analytics sets cookies that give us aggregate information about how the Service is used.",
      ],
    },
    {
      heading: "Your choices",
      body: [
        "You can clear or block cookies and local storage in your browser settings. If you do, some parts of the Service, such as staying signed in, may stop working.",
        `If we introduce advertising or other non-essential cookies, we will update this page and ask for your consent first. Questions? ${E.privacy}.`,
      ],
    },
  ],
};

const termsOfUse: InfoPage = {
  title: "Terms of use",
  text: `The rules for browsing, listing and contacting others on ${BRAND.name}. ${UPDATED}.`,
  sections: [
    {
      heading: "Using Hodii",
      body: [
        `${BRAND.name} is free to browse. By using the Service you agree to these Terms of use, our Terms and conditions and our Privacy policy. If you do not agree, please do not use the Service.`,
      ],
    },
    {
      heading: "Rules for everyone",
      bullets: [
        "Be honest. Do not post or send anything false, misleading or fraudulent.",
        "Be respectful. No harassment, threats, hate speech or discrimination.",
        "Do not share anyone's private information without their permission.",
        "Do not impersonate another person or agency, or misrepresent your relationship to a property.",
        "Do not post links to malware, scams or misleading sites.",
        "Do not use the Service for anything unlawful.",
      ],
    },
    {
      heading: "Rules for listers",
      bullets: [
        "Only list properties you own or are authorised to sell or let.",
        "Follow our Listing standards: accurate details, real photos, honest prices.",
        "Never ask for money before a seeker has viewed the property.",
        "Respond to enquiries in good faith and remove or mark properties that are no longer available.",
      ],
    },
    {
      heading: "Acceptable use",
      bullets: [
        "Do not scrape, copy in bulk, or systematically download listings, photographs or other content, including to train artificial intelligence systems, without our written permission.",
        "Do not interfere with the Service, probe it for weaknesses, or attempt to access accounts or data that are not yours.",
        "Do not use enquiry forms or contact details to send unsolicited marketing or spam.",
      ],
    },
    {
      heading: "Moderation and reporting",
      body: [
        `We may remove content, limit features or suspend accounts that break these rules, with or without notice. Repeated or serious breaches lead to permanent removal. Report a problem with the report option on a listing, or write to ${E.report}. If you think we got a decision wrong, write to ${E.support}.`,
      ],
    },
  ],
};

const termsAndConditions: InfoPage = {
  title: "Terms and conditions",
  text: `The agreement between you and ${BRAND.legalName} when you use ${BRAND.domain} and our services. Please read it carefully. ${UPDATED}.`,
  sections: [
    {
      heading: "1. Agreement",
      body: [
        `These Terms and conditions, together with our Terms of use, Privacy policy, Cookie policy and Listing standards, form the agreement between you and ${CO}. By creating an account or using the Service you accept them.`,
      ],
    },
    {
      heading: "2. Who we are and what we do",
      body: [
        "Hodii is an online marketplace that lets agencies, developers and owners advertise property, and lets people searching for property find it and contact the lister. We are not an estate agent, landlord, seller, lender or advocate. We are not a party to any sale, tenancy or other contract between users, and we do not collect rent, deposits or purchase money.",
      ],
    },
    {
      heading: "3. Eligibility and accounts",
      bullets: [
        "You must be at least 18 and able to enter into a binding contract.",
        "Give accurate information and keep it up to date. Keep your password secret: you are responsible for activity on your account.",
        "Agency accounts must be opened by someone authorised to act for the agency, which must hold any registration the law requires of it.",
        "One person may hold a personal account and be a member of one or more agency accounts.",
        "You are responsible for keeping your password and any recovery codes safe. Anyone who has a recovery code can open your account, so store them somewhere private. Tell us at once if you think your account has been used without your permission.",
      ],
    },
    {
      heading: "4. Listings",
      body: [
        "Listers are solely responsible for the accuracy, legality and availability of what they list, and confirm that they own the property or are authorised to market it. By publishing content you give us a non-exclusive, worldwide, royalty-free licence to host, display, adapt for formatting, and promote it on and in connection with the Service. You keep ownership of your content, and you must have the right to upload it, including any photographs.",
        "We may review, edit for formatting, refuse, hide or remove any listing that breaks our standards or that we reasonably believe is inaccurate, unlawful or harmful.",
      ],
    },
    {
      heading: "4A. Bulk uploads and bulk changes",
      body: [
        "Agencies may upload listings in bulk with a CSV file and change or remove many listings at once. You are responsible for everything you upload and for each change you confirm. Imported listings are saved as drafts for you to check and publish. Deleting listings is permanent, and you are asked to confirm it more than once. We cannot restore deleted listings.",
      ],
    },
    {
      heading: "4B. Reviews and comments",
      body: [
        "Reviews must be honest, based on your own dealings with the agency, and free of abuse, personal details, discrimination or advertising. You may leave one review per agency. Agencies may not review themselves, pay for or trade reviews, or pressure people to remove them, and may reply once to each review. Reviews that are reported by several people are hidden until we have looked at them, and we may remove any review that breaks these terms. A review you wrote is your own opinion and not ours.",
      ],
    },
    {
      heading: "5. Dealing with other users",
      body: [
        "You are responsible for your own decisions and dealings. Before you pay money, sign an agreement or buy or rent a property, inspect it, verify ownership and authority, and take independent legal advice where appropriate. We do not guarantee that any listing is accurate, complete or available, or that any user is who they say they are.",
      ],
    },
    {
      heading: "6. Fees and promotion",
      body: [
        "Browsing and saving properties are free. Some features for listers, such as boosting a listing or Premium packages, may be paid for. Prices, in Kenya shillings, will be shown before you buy, and are subject to applicable taxes. Paid promotion is always labelled as such.",
        "A boost is paid by M-Pesa for the number of days you choose, and starts when the payment is confirmed. A Premium package is paid by M-Pesa for a fixed term (30 days unless stated at purchase) and covers the number of listings you buy; you can add listings to it and remove them at any time. Boosts and packages improve where listings appear, always with a visible badge, but do not change what a listing must comply with and do not put a poor match above a good one. Time that has started is not refundable, including when you remove a listing from a package early, except where we failed to deliver it or the law requires a refund. If a payment goes through but nothing is activated, contact us with the M-Pesa receipt number and we will fix it or refund you. Boosting is optional: your listing is published whether or not you pay. We keep a record of every payment attempt.",
      ],
    },
    {
      heading: "7. Our content",
      body: [
        "The Service, including its design, text, graphics, software and data, belongs to us or our licensors and is protected by copyright and other laws. You may use it for your own personal, non-commercial purposes in line with these terms, and no more.",
      ],
    },
    {
      heading: "8. No professional advice",
      body: [
        "Information on Hodii, including guides and market information, is general and for convenience. It is not legal, financial, tax, valuation or investment advice. Consult an appropriate professional before acting on it.",
      ],
    },
    {
      heading: "9. Third-party links and services",
      body: ["The Service may link to third-party sites and services. We do not control them and are not responsible for them."],
    },
    {
      heading: "10. Copyright and content complaints",
      body: [
        `If you believe content on Hodii infringes your rights, or you are the owner of a property that is listed without your authority, write to ${E.legal} with the listing link, details of your claim and your contact information. We will review it promptly.`,
      ],
    },
    {
      heading: "11. Suspension and termination",
      body: [
        "You may close your account at any time. We may suspend or end your access if you break these terms, if we suspect fraud or abuse, or where the law requires, and we will give notice where we reasonably can.",
      ],
    },
    {
      heading: "12. Disclaimers",
      body: [
        "The Service is provided “as is” and “as available”. To the fullest extent the law allows, we do not promise that it will be uninterrupted or error-free, or that listings or information on it are accurate or complete.",
      ],
    },
    {
      heading: "13. Limitation of liability",
      body: [
        "To the fullest extent the law allows, we are not liable for loss arising from your dealings with other users, from reliance on listings or information, or from indirect or consequential loss. Nothing in these terms limits liability that cannot be limited by law, including for fraud or for death or personal injury caused by negligence, or limits your rights as a consumer under the Consumer Protection Act, 2012.",
      ],
    },
    {
      heading: "14. Indemnity",
      body: [
        "You agree to compensate us for loss that arises from content you post or from your breach of these terms or of the law, to the extent the law allows.",
      ],
    },
    {
      heading: "15. Changes",
      body: ["We may update these terms. We will give notice of material changes on the Service before they take effect. Continued use after that means you accept them."],
    },
    {
      heading: "16. Governing law and disputes",
      body: [
        "These terms are governed by the laws of Kenya. We hope to resolve any complaint informally first, so please write to us. Disputes that cannot be settled that way are subject to the jurisdiction of the courts of Kenya.",
      ],
    },
    {
      heading: "17. General",
      body: [
        "If any part of these terms is found unenforceable, the rest remains in force. Our failure to enforce a term is not a waiver of it. You may not transfer your rights under these terms without our consent.",
      ],
    },
    {
      heading: "Contact",
      body: [`${BRAND.legalName}, ${BRAND.address}. Legal notices: ${E.legal}.`],
    },
  ],
};

const accessibility: InfoPage = {
  title: "Accessibility",
  text: "Hodii should be usable by everyone, on any device and with any ability. Here is what we do, and how to tell us when we fall short.",
  sections: [
    {
      heading: "Our commitment",
      body: ["We aim to follow the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA, and to improve with every release."],
    },
    {
      heading: "What we do",
      bullets: [
        "Semantic page structure and keyboard-friendly navigation.",
        "Light and dark themes, and layouts that work from small phones to large screens.",
        "Descriptive text for controls and images where they carry meaning.",
        "Colour contrast designed to remain readable.",
      ],
    },
    {
      heading: "Known limitations",
      body: [
        "Photographs uploaded by listers may not have descriptions. We are working on ways to prompt listers to add them.",
      ],
    },
    {
      heading: "Feedback and help",
      body: [`If something is hard to use, write to ${E.support} and tell us what happened and what device or assistive technology you use. We will respond within two working days.`],
    },
  ],
};

export const supportAndLegalPages: Record<string, InfoPage> = {
  "help-centre": {
    title: "Help centre",
    text: "Quick answers to the most common questions. Can't find what you need? Write to us.",
    sections: [
      {
        heading: "Searching for a property",
        bullets: [
          "Use the search and filters to narrow by county, area, price, property type and bedrooms.",
          "Create a free account to save properties and come back to them later.",
          "To ask about a property, use the enquiry form on its listing: your message goes straight to the lister.",
        ],
      },
      {
        heading: "Listing a property",
        bullets: [
          "Create an account and choose whether you list as an individual or on behalf of an agency.",
          "Add a clear title, a description, a price, the location and several photographs.",
          "See the Listing standards for what every listing must include.",
        ],
      },
      {
        heading: "Account",
        bullets: [
          "Sign in with your email address and password.",
          "You can change your display name from your profile.",
          `Locked out or something looks wrong? Write to ${E.support} from the email you registered with.`,
        ],
      },
      {
        heading: "Safety",
        bullets: [
          "Never pay a deposit, fee or rent before you have viewed the property.",
          "Read our Safety and fraud page, and use the report option on any suspicious listing.",
        ],
      },
      {
        heading: "Still need help?",
        body: [`Write to ${E.support}. We answer within two working days.`],
      },
    ],
  },
  "manage-account": {
    title: "Manage your account",
    text: "Change your details, see your saved properties and control your data.",
    sections: [
      {
        heading: "Your profile",
        body: ["Sign in and open your profile from the account button at the top of any page. There you can change your display name and see the properties you have saved."],
      },
      {
        heading: "Your data",
        bullets: ["Download a copy of the data we hold about you: open your profile and choose Download your data.", "Correct anything that is wrong.", "Delete your account and the data linked to it: open your profile and choose Delete account."],
        body: [`If you cannot do something yourself, write to ${E.privacy} from the email address on your account. We respond within the time the law allows, usually much sooner.`],
      },
      {
        heading: "Signing out",
        body: ["Use the account button at the top of the page and choose Sign out. Signing out on one device does not sign you out elsewhere."],
      },
    ],
  },
  "privacy-policy": privacy,
  privacy,
  "cookie-policy": cookies,
  cookies,
  "terms-of-use": termsOfUse,
  terms: termsAndConditions,
  "terms-and-conditions": termsAndConditions,
  accessibility,
};
