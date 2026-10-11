/**
 * Starter Seed Data Module for Database Initialization
 */

window.SEED_DATA = {
  businessProfile: {
    businessName: "Vanakkam Cafe",
    logo: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=200&auto=format&fit=crop&q=80",
    address: "Plot 45, Sector 18, Commercial Hub, New Delhi - 110001",
    gstNumber: "07AAAAA0000A1Z5",
    gstPercentage: 5,
    phone: "+91 98765 43210",
    email: "contact@vanakkamcafe.com",
    invoicePrefix: "VK-INV-",
    invoiceFooter: "Thank you for dining at Vanakkam Cafe! Please visit again."
  },

  landingConfig: {
    brandName: "Vanakkam Cafe",
    logoUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=200&auto=format&fit=crop&q=80",
    headerCtaText: "🎉 View Active Offers & Deals",
    headerCtaLink: "#offers-sec",
    
    heroBadge: "✨ Welcome to Vanakkam Cafe",
    heroTitle: "Authentic South Indian Heritage & Fine Gourmet Delicacies",
    heroSubtitle: "Experience golden crisp ghee dosas, steaming button idlis, aromatic degree filter coffee, and modern fusion delicacies prepared with 100% pure ghee & organic spices.",
    heroImageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=1200&auto=format&fit=crop&q=80",
    heroCtaPrimaryText: "🔥 Discover Active Cafe Offers",
    heroCtaPrimaryLink: "#offers-sec",
    heroCtaSecondaryText: "📱 Explore Cafe Facilities",
    heroCtaSecondaryLink: "#facilities-sec",

    stat1Val: "100+",
    stat1Label: "Authentic Delicacies",
    stat2Val: "4.9 ★",
    stat2Label: "Guest Rating Score",
    stat3Val: "100%",
    stat3Label: "Pure Ghee & Natural Spices",
    stat4Val: "< 10 Mins",
    stat4Label: "Fast Table Service",

    // Active Offers
    offer1Badge: "MORNING SPECIAL",
    offer1Title: "Traditional Degree Filter Coffee Combo",
    offer1Desc: "Authentic piping hot Kumbakonam Filter Coffee served with 2 crispy Medu Vadas & fresh coconut chutney.",
    offer1Price: "Just ₹99",
    offer1ImageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",

    offer2Badge: "FAMILY FESTIVAL",
    offer2Title: "Weekend Grand Royal South Indian Thali",
    offer2Desc: "Flat 20% OFF on 14-item Royal Feast featuring Ghee Roast Dosa, Malabar Parotta, Sambar & Payasam.",
    offer2Price: "Flat 20% OFF",
    offer2ImageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=600&auto=format&fit=crop&q=80",

    offer3Badge: "CORPORATE LUNCH",
    offer3Title: "Executive Ghee Dosa & Mini Meal Special",
    offer3Desc: "Crispy Ghee Masala Dosa + Mini Uttapam + Filter Coffee + Dessert for quick weekday power lunches.",
    offer3Price: "Special ₹149",
    offer3ImageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80",

    // Facilities
    facility1Title: "📱 Contactless Table QR Code Menu",
    facility1Desc: "Every dining table inside Vanakkam Cafe features a QR code. Seated guests simply scan with their smartphone to view high-definition photos & custom options!",
    facility1ImageUrl: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&auto=format&fit=crop&q=80",

    facility2Title: "🌿 100% Pure Ghee & Natural Spices",
    facility2Desc: "We take pride in using 100% pure A2 cow ghee, cold-pressed sesame oil, fresh curry leaves, and authentic stone-ground spices for healthy & delicious food.",
    facility2ImageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80",

    facility3Title: "❄️ Luxury AC Family Dining & Rooftop",
    facility3Desc: "Comfortable air-conditioned family dining hall with plush seating, ambient heritage decor, outdoor rooftop lounge, and express takeaway.",
    facility3ImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80",

    // Gallery
    galleryTitle: "Chef's Signature Delicacies",
    gallerySubtitle: "Artisanal gourmet creations prepared with organic ingredients and exquisite presentation.",
    gallery1Title: "Mysore Royal Ghee Masala Dosa",
    gallery1Tag: "Chef's Special",
    gallery1ImageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=800&auto=format&fit=crop&q=80",

    gallery2Title: "Kumbakonam Degree Filter Coffee",
    gallery2Tag: "Heritage Brew",
    gallery2ImageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",

    gallery3Title: "Chettinad Spicy Paneer Sizzler",
    gallery3Tag: "Fusion Gourmet",
    gallery3ImageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=80",

    // Reviews
    testimonialTitle: "Voices of Satisfaction",
    testimonialSubtitle: "Read reviews from food critics, executive chefs, and frequent cafe guests.",
    review1Quote: "Vanakkam Cafe serves the most authentic degree filter coffee and crispy ghee masala dosa! The table QR menu explanation made ordering so effortless.",
    review1Author: "Sundaram V.",
    review1Role: "Food Connoisseur & Critic",
    review1AvatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",

    review2Quote: "The weekend Thali family offer was unbelievable value for money. Pure ghee aroma in every dish and excellent AC dining ambience.",
    review2Author: "Meenakshi Ramesh",
    review2Role: "Lifestyle & Food Blogger",
    review2AvatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",

    // Footer & Social Channels
    footerTagline: "Celebrating South Indian Heritage, Pure Ghee Craftsmanship & Warm Hospitality.",
    footerAddress: "Plot 45, Sector 18, Commercial Hub, New Delhi - 110001",
    footerPhone: "+91 98765 43210",
    footerEmail: "contact@vanakkamcafe.com",
    footerCopyright: "© 2026 Vanakkam Cafe. All Rights Reserved.",

    socialInstagram: "https://instagram.com/vanakkamcafe",
    socialFacebook: "https://facebook.com/vanakkamcafe",
    socialWhatsApp: "https://wa.me/919876543210",
    socialYouTube: "https://youtube.com/@vanakkamcafe",
    socialTwitter: "https://twitter.com/vanakkamcafe"
  },

  categories: [
    "Starters", "Main Course", "Biryani", "Tandoor", "Indian", "Chinese", 
    "Momos", "Noodles", "Beverages", "Mocktails", "Coffee", "Desserts", "Healthy/Gym Food"
  ],

  tables: [
    { tableId: "tbl_01", tableNumber: "Table 01", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_02", tableNumber: "Table 02", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_03", tableNumber: "Table 03", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_04", tableNumber: "Table 04", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_05", tableNumber: "Table 05", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_06", tableNumber: "Table 06", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_07", tableNumber: "Table 07", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_08", tableNumber: "Table 08", status: "AVAILABLE", isActive: true, currentSessionId: null }
  ],

  products: [],
  inventory: [],
  capital: [],
  expenses: [],
  managers: []
};
