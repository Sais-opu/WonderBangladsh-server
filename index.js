const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors());
app.use(express.json());






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ih9r7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        // For jwt token used for role based
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '5h',
            });

            res.status(200).json({ token });
        });

        app.get('/protected', (req, res) => {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ message: 'No token provided' });

            try {
                const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                res.status(200).json({ message: 'Access granted', user: decoded });
            } catch (error) {
                res.status(403).json({ message: 'Invalid or expired token' });
            }
        });

        //register-----------------------------------------------------------------------------------------------
        
        app.post('/register', async (req, res) => {
            try {
                console.log("Received registration request with data:", req.body); // Log received request body

                const { firstName, lastName, email, photoURL } = req.body;

                // Check for missing required fields
                if (!firstName || !lastName || !email) {
                    console.log("Missing required fields: firstName, lastName, or email"); // Log missing fields
                    return res.status(400).json({ message: "First name, last name, and email are required" });
                }

                const fullName = `${firstName} ${lastName}`;
                const newUser = {
                    fullName,
                    email,
                    photoURL: photoURL || "default-url",
                    userRole: "Tourist",
                    registrationDate: new Date(),
                };

                console.log("Prepared new user data:", newUser); // Log prepared user data

                const database = client.db("wonderBangladesh");
                const collection = database.collection("users");

                // Check if a user with the same email already exists
                const existingUser = await collection.findOne({ email });
                if (existingUser) {
                    console.log(`User with email ${email} already exists`); // Log existing user
                    return res.status(400).json({ message: "User with this email already exists" });
                }

                // Insert the new user into the collection
                const result = await collection.insertOne(newUser);
                console.log("User successfully inserted into the database:", result); // Log successful insertion

                res.status(201).json({
                    message: "User registered successfully",
                    userId: result.insertedId,
                });
            } catch (error) {
                console.error("Error registering user:", error); // Log any errors that occur
                res.status(500).json({ message: "Error registering user", error: error.message });
            }
        });
        app.get('/users', async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) {
                    return res.status(400).json({ message: "Email is required" });
                }

                const database = client.db("wonderBangladesh");
                const collection = database.collection("users");

                const user = await collection.findOne({ email });
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }

                res.json(user);
            } catch (error) {
                res.status(500).json({ message: 'Server error' });
            }
        });
        // all users for admin
        app.get('/users/all', async (req, res) => {
            try {
                const { search, role } = req.query;
                console.log('Query Parameters:', { search, role });

                const database = client.db("wonderBangladesh");
                const collection = database.collection("users");

                const query = {};
                if (search) {
                    query.$or = [
                        { name: { $regex: new RegExp(search, "i") } },
                        { email: { $regex: new RegExp(search, "i") } }
                    ];
                }
                if (role) {
                    query.userRole = role;
                }

                console.log('Final Query:', query);

                const users = await collection.find(query).toArray();
                console.log('Fetched Users:', users);

                res.json(users);
            } catch (error) {
                console.error("Error fetching users:", error.message);
                res.status(500).json({ message: "Failed to fetch users.", error: error.message });
            }
        });

        
        app.get('/users/role', async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) {
                    return res.status(400).json({ message: "Email is required" });
                }

                const database = client.db("wonderBangladesh");
                const collection = database.collection("users");

                const user = await collection.findOne({ email });
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }

                res.status(200).json({ role: user.userRole || 'Tourist' }); // Default role if none found
            } catch (error) {
                console.error("Error fetching user role:", error);
                res.status(500).json({ message: "Error fetching user role", error: error.message });
            }
        });

        //stories---------------------------------------------------------------------------------------------------
        
        app.get('/stories/all', async (req, res) => {
            try {
                const database = client.db("wonderBangladesh");
                const collection = database.collection("stories");
                const packages = await collection.find({}).toArray();

                res.send(packages);
            } catch (error) {
                console.error("Error fetching all packages:", error);
                res.status(500).send({ message: "Failed to fetch all packages" });
            }
        });
        app.get('/stories/random', async (req, res) => {
            try {
                const database = client.db("wonderBangladesh");
                const Story = database.collection("stories");

                //userRole is 'tourist'
                const stories = await Story.aggregate([
                    { $match: { userRole: 'Tourist' } },
                    { $sample: { size: 4 } }
                ]).toArray();

                if (stories.length === 0) {
                    return res.status(404).json({ message: "No stories found" });
                }

                res.status(200).json(stories);
            } catch (error) {
                console.error("Error fetching stories:", error);
                res.status(500).json({ message: "Error fetching stories", error });
            }
        });


        app.post('/stories/add', async (req, res) => {
            try {
                console.log('Request Body:', req.body);
                const {
                    title,
                    text,
                    userImage,
                    userName,
                    email,
                    userRole,
                    images = [], 
                    shareCount = 0,
                    reactCount = 0
                } = req.body;
                const parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
                //story object
                const story = {
                    title,
                    text,
                    userImage,
                    userName,
                    email,
                    userRole,
                    shareCount: parseInt(shareCount, 10),
                    reactCount: parseInt(reactCount, 10),
                    images: parsedImages,
                    createdAt: new Date(),
                };

                // database
                const database = client.db('wonderBangladesh');
                const collection = database.collection('stories');
                const result = await collection.insertOne(story);

                if (result.acknowledged) {
                    res.status(200).json({ message: 'Story added successfully', story });
                } else {
                    res.status(500).json({ message: 'Failed to add story' });
                }
            } catch (error) {
                console.error('Error adding story:', error);
                res.status(500).json({ message: 'Error adding story', error });
            }
        });


        app.get('/stories', async (req, res) => {
            try {
                const userEmail = req.query.email;
                if (!userEmail) {
                    console.warn('Email query parameter is missing');
                    return res.status(400).json({ message: 'Email query parameter is required' });
                }

                console.log('Fetching stories for email:', userEmail); 

                // Connect to the database
                const database = client.db("wonderBangladesh");

                // correct field name in database
                const stories = await database.collection('stories').find({ email: userEmail }).toArray();
                // Check iftoriesfound
                if (!stories || stories.length === 0) {
                    console.warn('No stories found for email:', userEmail); 
                    return res.status(404).json({ message: 'No stories found' });
                }
                res.status(200).json({ stories });
            } catch (error) {
                console.error('Error fetching stories:', error); // Log the error
                res.status(500).json({ message: 'Internal server error while fetching stories' });
            }
        });


    }



    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('welcome to Bangladesh')
})

app.listen(port, () => {
    console.log(`SIMPLE crud is running on port: ${port}`)
})