const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000'
].filter(Boolean);

export const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or health checks)
        if (!origin) {
            return callback(null, true);
        }

        const isAllowed = allowedOrigins.includes(origin) ||
                          origin.endsWith('.vercel.app') ||
                          origin.startsWith('http://localhost:');

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
};
