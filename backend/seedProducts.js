import mongoose from 'mongoose';
import AffiliateProduct from './models/affiliateProduct.model.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fync';

const products = [
    {
        name: "Apple MacBook Air Laptop: Apple M2 chip, 13.6-inch Liquid Retina Display",
        description: "Strikingly thin and fast. The M2-powered MacBook Air is the ultimate laptop for students. With 18 hours of battery life and a silent, fanless design.",
        price: 99900,
        originalPrice: 114900,
        image: "https://m.media-amazon.com/images/I/719C6bJv8jL._SL1500_.jpg",
        category: "Electronics",
        affiliateLink: "https://www.apple.com/in/shop/buy-mac/macbook-air",
        brand: "Apple",
        commissionRate: 5,
        rating: 4.8,
        reviewsCount: 1250
    },
    {
        name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
        description: "The best noise cancelling technology gets even better. Experience industry-leading noise cancellation with the new Integrated Processor V1.",
        price: 29990,
        originalPrice: 34990,
        image: "https://m.media-amazon.com/images/I/61+9yz9f6FL._SL1500_.jpg",
        category: "Electronics",
        affiliateLink: "https://www.amazon.in/Sony-WH-1000XM5-Wireless-Cancelling-Headphones/dp/B0B3C4HBSL",
        brand: "Sony",
        commissionRate: 10,
        rating: 4.7,
        reviewsCount: 850
    },
    {
        name: "Atomic Habits: An Easy & Proven Way to Build Good Habits",
        description: "The #1 New York Times bestseller. Over 10 million copies sold. Tiny Changes, Remarkable Results.",
        price: 499,
        originalPrice: 799,
        image: "https://m.media-amazon.com/images/I/91bYsX41DVL._SL1500_.jpg",
        category: "Books",
        affiliateLink: "https://www.amazon.in/Atomic-Habits-James-Clear/dp/1847941834",
        brand: "Penguin",
        commissionRate: 15,
        rating: 4.9,
        reviewsCount: 2500
    },
    {
        name: "Fujifilm Instax Mini 12 Instant Camera",
        description: "Produce instant credit card-sized photos. Built-in selfie mirror and macro mode for close-up shots.",
        price: 6499,
        originalPrice: 7999,
        image: "https://m.media-amazon.com/images/I/61NfT+d-XKL._SL1500_.jpg",
        category: "Lifestyle",
        affiliateLink: "https://www.amazon.in/Fujifilm-Instax-Mini-12-Instant-Camera/dp/B0BY2HBC2F",
        brand: "Fujifilm",
        commissionRate: 8,
        rating: 4.5,
        reviewsCount: 420
    }
];

const seedDB = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected!');

        console.log('Clearing existing products...');
        await AffiliateProduct.deleteMany({});

        console.log('Seeding products...');
        await AffiliateProduct.insertMany(products);

        console.log('Database seeded successfully! 🌱');
        process.exit();
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDB();
