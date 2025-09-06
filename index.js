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

        app.put('/update-user', async (req, res) => {
            try {
                const { userId, firstName, lastName, photoURL } = req.body;

                if (!userId || !firstName || !lastName || !photoURL) {
                    return res.status(400).json({ message: "Required fields missing" });
                }

                const database = client.db("imtiaztourismltd");
                const collection = database.collection("users");

                const updatedUser = {
                    firstName,
                    lastName,
                    photoURL,
                };

                const result = await collection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: updatedUser }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ message: "User not found" });
                }

                const updatedUserData = await collection.findOne({ _id: new ObjectId(userId) });
                res.status(200).json(updatedUserData);
            } catch (error) {
                console.error("Error updating user:", error);
                res.status(500).json({ message: "Error updating user", error: error.message });
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

        // // ourpackages--------------------------------------------------------------------------------------------

        // app.get('/ourpackages', async (req, res) => {
        //     try {
        //         const database = client.db("wonderBangladesh");
        //         const collection = database.collection("ourpackages");
        //         const packages = await collection.aggregate([{ $sample: { size: 3 } }]).toArray(); // Fetch random 3 packages
        //         res.send(packages);
        //     } catch (error) {
        //         console.error("Error fetching random packages:", error);
        //         res.status(500).send({ message: "Failed to fetch random packages" });
        //     }
        // });

        // app.get('/ourpackages/allpackages', async (req, res) => {
        //     try {
        //         const database = client.db("wonderBangladesh");
        //         const collection = database.collection("ourpackages");
        //         const packages = await collection.find({}).toArray(); // Fetch all packages
        //         res.send(packages);
        //     } catch (error) {
        //         console.error("Error fetching all packages:", error);
        //         res.status(500).send({ message: "Failed to fetch all packages" });
        //     }
        // });
        // app.get('/ourpackages/:id', async (req, res) => {
        //     try {
        //         const { id } = req.params;
        //         if (!ObjectId.isValid(id)) {
        //             return res.status(400).send({ message: "Invalid package ID" });
        //         }

        //         const database = client.db("wonderBangladesh");
        //         const collection = database.collection("ourpackages");
        //         const packageDetails = await collection.findOne({ _id: new ObjectId(id) });

        //         if (!packageDetails) {
        //             return res.status(404).send({ message: "Package not found" });
        //         }

        //         res.send(packageDetails);
        //     } catch (error) {
        //         console.error("Error fetching package details:", error);
        //         res.status(500).send({ message: "Failed to fetch package details" });
        //     }
        // });
        // app.post('/ourpackages', async (req, res) => {
        //     try {
        //         const packageData = req.body;
        //         const db = client.db('wonderBangladesh')

        //         const collection = db.collection('ourpackages');

        //         const result = await collection.insertOne(packageData);
        //         res.status(201).json({ success: true, data: result });
        //     } catch (error) {
        //         console.error('Error saving package:', error.message);
        //         res.status(500).json({ success: false, message: 'Failed to save package.' });
        //     }
        // });

        //booking -----------------------------------------------------------------------------------------------

        // app.post('/bookings', async (req, res) => {
        //     try {
        //         const { packageId, packageName, touristName, touristEmail, touristImage, price, tourDate, guideName } = req.body;

        //         console.log("Received booking data:", req.body);

        //         if (!packageId || !packageName || !touristName || !touristEmail || !price || !tourDate || !guideName) {
        //             return res.status(400).send({ message: "All fields are required" });
        //         }

        //         const database = client.db("imtiaztourismltd");
        //         const collection = database.collection("bookings");

        //         const booking = {
        //             packageId,
        //             packageName,
        //             touristName,
        //             touristEmail,
        //             touristImage,
        //             price,
        //             tourDate,
        //             guideName,
        //             status: "pending",
        //             createdAt: new Date(),
        //         };

        //         const result = await collection.insertOne(booking);
        //         console.log("Booking stored in database:", result.insertedId);
        //         res.send({ message: "Booking successful", bookingId: result.insertedId });
        //     } catch (error) {
        //         console.error("Error creating booking:", error);
        //         res.status(500).send({ message: "Failed to create booking" });
        //     }
        // });

        // app.get('/bookings', async (req, res) => {
        //     const { email } = req.query;
        //     console.log("Received email:", email);

        //     if (!email) {
        //         return res.status(400).json({ message: "Email is required" });
        //     }

        //     try {
        //         const database = client.db("imtiaztourismltd");
        //         const collection = database.collection("bookings");

        //         const bookings = await collection.find({ touristEmail: email }).toArray();

        //         console.log("Bookings fetched:", bookings);
        //         if (!bookings.length) {
        //             return res.status(404).json({ message: "No bookings found" });
        //         }

        //         res.json(bookings);
        //     } catch (error) {
        //         console.error("Error in /bookings:", error);
        //         res.status(500).json({ message: 'Server error' });
        //     }
        // });


        // // GET: Fetch bookings assigned to a specific guide
        // app.get("/bookings/byguide", async (req, res) => {
        //     try {
        //         const { guideName } = req.query;

        //         if (!guideName) {
        //             return res.status(400).send({ message: "Guide name is required." });
        //         }

        //         const database = client.db("imtiaztourismltd");
        //         const bookingsCollection = database.collection("bookings");

        //         // Query to filter by guide name
        //         const bookings = await bookingsCollection.find({ guideName }).toArray();
        //         res.send(bookings);
        //     } catch (error) {
        //         console.error("Error fetching bookings:", error);
        //         res.status(500).send({ message: "Failed to fetch bookings." });
        //     }
        // });



        // // PATCH: Update booking status
        // app.patch("/bookings/:id", async (req, res) => {
        //     try {
        //         const database = client.db("imtiaztourismltd");
        //         const bookingsCollection = database.collection("bookings");
        //         const { id } = req.params;
        //         const { status } = req.body;

        //         console.log("Updating booking:", id, "to status:", status);

        //         if (!status) {
        //             return res.status(400).send({ message: "Status is required" });
        //         }

        //         const result = await bookingsCollection.updateOne(
        //             { _id: new ObjectId(id) },
        //             { $set: { status } }
        //         );

        //         if (result.modifiedCount === 0) {
        //             return res.status(404).send({ message: "Booking not found or status already updated" });
        //         }

        //         res.send({ message: "Status updated successfully" });
        //     } catch (error) {
        //         console.error("Error updating status:", error);
        //         res.status(500).send({ message: "Failed to update status" });
        //     }
        // });

        // app.delete("/bookings/:id", async (req, res) => {
        //     try {
        //         const database = client.db("imtiaztourismltd");
        //         const bookingsCollection = database.collection("bookings");
        //         const { id } = req.params;

        //         console.log("Deleting booking:", id);

        //         const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });

        //         if (result.deletedCount === 0) {
        //             return res.status(404).send({ message: "Booking not found" });
        //         }

        //         res.send({ message: "Booking deleted successfully" });
        //     } catch (error) {
        //         console.error("Error deleting booking:", error);
        //         res.status(500).send({ message: "Failed to delete booking" });
        //     }
        // });

        //inside payment
        app.patch('/bookings/:id', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            try {
                const database = client.db("imtiaztourismltd");
                const bookingsCollection = database.collection("bookings");

                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                res.json(result);
            } catch (error) {
                console.error('Error updating booking:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        //Payment---------------------------------------------------------------

        app.post('/create-payment-intent', async (req, res) => {
            const { amount, bookingId } = req.body;

            try {
                if (!amount || amount <= 0) {
                    return res.status(400).json({ error: 'Invalid amount' });
                }

                const paymentIntent = await stripe.paymentIntents.create({
                    amount, // Amount in cents
                    currency: 'usd',
                });

                // Save payment transaction to the database
                const database = client.db("imtiaztourismltd");
                const paymentsCollection = database.collection("payments");
                await paymentsCollection.insertOne({
                    paymentIntentId: paymentIntent.id,
                    bookingId,
                    amount,
                    status: 'pending',
                    createdAt: new Date(),
                });

                // Return the client secret to the frontend
                res.json({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                console.error('Error creating payment intent:', error.message);
                res.status(500).json({ error: error.message });
            }
        });


        app.post('/payments/update', async (req, res) => {
            const { paymentIntentId, status } = req.body;

            try {
                const database = client.db("imtiaztourismltd");
                const paymentsCollection = database.collection("payments");

                const result = await paymentsCollection.updateOne(
                    { paymentIntentId },
                    { $set: { status } }
                );

                res.json(result);
            } catch (error) {
                console.error('Error updating payment:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        //tourguide story
        app.get('/stories/guide', async (req, res) => {
            try {
                const guideEmail = req.query.email;
                if (!guideEmail) {
                    console.warn('Email query parameter is missing');
                    return res.status(400).json({ message: 'Email query parameter is required' });
                }

                // console.log('Fetching stories for email:', guideEmail);
                const database = client.db("imtiaztourismltd");

                const stories = await database.collection('stories').find({ email: guideEmail }).toArray();

                if (!stories || stories.length === 0) {
                    console.warn('No stories found for email:', guideEmail);
                    return res.status(404).json({ message: 'No stories found' });
                }


                res.status(200).json(stories);
            } catch (error) {
                console.error('Error fetching stories:', error);
                res.status(500).json({ message: 'Internal server error while fetching stories' });
            }
        });

        app.patch('/stories/remove-image', async (req, res) => {
            try {
                const { storyId, imagePath } = req.body;
                const db = client.db('imtiaztourismltd');

                const updatedStory = await db.collection('stories').updateOne(
                    { _id: new ObjectId(storyId) },
                    { $pull: { images: imagePath } }
                );

                if (updatedStory.modifiedCount > 0) {
                    const story = await db.collection('stories').findOne({ _id: new ObjectId(storyId) });
                    res.status(200).json(story);
                } else {
                    res.status(500).json({ message: 'Failed to remove image' });
                }
            } catch (error) {
                console.error('Error removing image:', error);
                res.status(500).json({ message: 'Error removing image' });
            }
        });
        app.delete('/stories/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const userEmail = req.query.email;
                const db = client.db('imtiaztourismltd');
                const story = await db.collection('stories').findOne({ _id: new ObjectId(id), userEmail });

                if (!story) {
                    return res.status(404).json({ message: 'Story not found or unauthorized' });
                }

                const result = await db.collection('stories').deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount > 0) {
                    res.status(200).json({ message: 'Story deleted successfully' });
                } else {
                    res.status(500).json({ message: 'Failed to delete story' });
                }
            } catch (error) {
                console.error('Error deleting story:', error);
                res.status(500).json({ message: 'Error deleting story' });
            }
        });
        app.put('/stories/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { title, text } = req.body;

                console.log('Updating story ID:', id);
                const db = client.db('imtiaztourismltd');

                const updatedStory = await db.collection('stories').findOneAndUpdate(
                    { _id: new ObjectId(id) },
                    { $set: { title, text, updatedAt: new Date() } },
                    { returnDocument: 'after' }
                );

                console.log('Updated Story Result:', updatedStory);

                if (updatedStory.value) {
                    res.status(200).json({ message: 'Story updated successfully', story: updatedStory.value });
                } else {
                    res.status(404).json({ message: 'Story not found' });
                }
            } catch (error) {
                console.error('Error updating story:', error);
                res.status(500).json({ message: 'Error updating story', error });
            }
        });

        //tourguide ------------------------------------------------------------------------------------

        app.get('/tourguides', async (req, res) => {
            try {
                const database = client.db("imtiaztourismltd");
                const collection = database.collection("tourguides");

                // Use aggregation to get 6 random tour guides
                const guides = await collection.aggregate([{ $sample: { size: 6 } }]).toArray();

                // Check if guides exist
                if (!guides || guides.length === 0) {
                    return res.status(404).send({ message: "No tour guides found" });
                }

                // Send the response
                res.send(guides);
            } catch (error) {
                console.error("Error fetching tour guides:", error);
                res.status(500).send({ message: "Failed to fetch tour guides" });
            }
        });
        app.get('/tourguides/all', async (req, res) => {
            try {
                const database = client.db("imtiaztourismltd");
                const collection = database.collection("tourguides");

                const packages = await collection.find({}).toArray();
                res.send(packages)

            } catch (error) {
                console.error("Error fetching tour guides:", error);
                res.status(500).send({ message: "Failed to fetch tour guides" });
            }
        });

        app.get('/tourguides/:id', async (req, res) => {
            try {
                const { id } = req.params;

                // Validate if the ID is a valid ObjectId
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ message: "Invalid guide ID format" });
                }

                const database = client.db("imtiaztourismltd");
                const collection = database.collection("tourguides");

                const guide = await collection.findOne({ _id: new ObjectId(id) });
                if (!guide) {
                    return res.status(404).send({ message: "Guide not found" });
                }

                res.send(guide);
            } catch (error) {
                console.error("Error fetching guide details:", error);
                res.status(500).send({ message: "Failed to fetch guide details" });
            }
        });

        app.post('/guideapplication', async (req, res) => {
            try {
                console.log('Request received:', req.body); // Log the entire request

                const {
                    title,
                    reason,
                    cvLink,
                    name,
                    email,
                    userRole,
                    image,
                    age,
                    experience,
                    languages,
                    speciality,
                    gender,
                } = req.body;

                console.log('Parsed data:', {
                    title,
                    reason,
                    cvLink,
                    name,
                    email,
                    userRole,
                    image,
                    age,
                    experience,
                    languages,
                    speciality,
                    gender,
                });

                if (!title || !reason || !cvLink || !name || !email) {
                    console.error('Missing required fields');
                    return res.status(400).json({ message: 'Missing required fields' });
                }

                const guideApplication = {
                    title,
                    reason,
                    cvLink,
                    name,
                    email,
                    userRole,
                    image,
                    age: parseInt(age, 10),
                    experience,
                    speciality,
                    languages: Array.isArray(languages) ? languages : languages.split(','),
                    gender,
                    status: 'pending',
                    createdAt: new Date(),
                };

                console.log('Guide application to save:', guideApplication);

                const database = client.db('imtiaztourismltd');
                const collection = database.collection('guideApplications');
                const result = await collection.insertOne(guideApplication);

                if (result.acknowledged) {
                    console.log('Application added successfully:', result);
                    res.status(200).json({ message: 'Application added successfully', guideApplication });
                } else {
                    console.error('Database insert failed:', result);
                    res.status(500).json({ message: 'Failed to add application' });
                }
            } catch (error) {
                console.error('Error adding application:', error.message);
                res.status(500).json({ message: 'Error adding application', error: error.message });
            }
        });


        app.get('/guideapplications', async (req, res) => {
            try {
                const database = client.db('imtiaztourismltd');
                const collection = database.collection('guideApplications');

                // Fetch all applications
                const applications = await collection.find().toArray();

                if (applications.length > 0) {
                    console.log('Applications fetched successfully:', applications);
                    res.status(200).json(applications);
                } else {
                    console.log('No applications found');
                    res.status(404).json({ message: 'No applications found' });
                }
            } catch (error) {
                console.error('Error fetching applications:', error.message);
                res.status(500).json({ message: 'Error fetching applications', error: error.message });
            }
        });
        app.post('/manageApplication', async (req, res) => {
            try {
                const { applicationId, action } = req.body;

                if (!applicationId || !action) {
                    return res.status(400).json({ message: 'Application ID and action are required' });
                }

                const database = client.db('imtiaztourismltd');
                const applicationsCollection = database.collection('guideApplications');
                const tourGuidesCollection = database.collection('tourguides');
                const usersCollection = database.collection('users'); // Reference to the users collection

                // Fetch the application by ID
                const application = await applicationsCollection.findOne({ _id: new ObjectId(applicationId) });

                if (!application) {
                    return res.status(404).json({ message: 'Application not found' });
                }

                if (action === 'accept') {
                    const guide = {
                        guide_id: new ObjectId().toString(), // Generate a unique guide ID
                        name: application.name,
                        age: application.age,
                        gender: application.gender,
                        languages: application.languages,
                        experience: application.experience,
                        speciality: application.speciality,
                        rating: 0,
                        availability: 'Available',
                        img: application.image,
                        email: application.email,
                        userRole: 'Tour Guide',
                    };

                    await tourGuidesCollection.insertOne(guide);

                    await usersCollection.updateOne(
                        { email: application.email },
                        { $set: { userRole: 'Tour guide' } }
                    );

                    await applicationsCollection.deleteOne({ _id: new ObjectId(applicationId) });

                    return res.status(200).json({ message: 'Application accepted, guide added, userRole updated, and application removed' });
                } else if (action === 'reject') {
                    await applicationsCollection.deleteOne({ _id: new ObjectId(applicationId) });

                    return res.status(200).json({ message: 'Application rejected and removed' });
                } else {
                    return res.status(400).json({ message: 'Invalid action' });
                }
            } catch (error) {
                console.error('Error managing application:', error.message);
                res.status(500).json({ message: 'Error managing application', error: error.message });
            }
        });

        //admin panel------------------------------------------------------------

        // //-----------------------------------------

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

        app.get('/admin/payments/total', async (req, res) => {
            try {
                const database = client.db("imtiaztourismltd");
                const collection = database.collection("bookings");
                const totalPayment = await collection.aggregate([
                    { $group: { _id: null, total: { $sum: "$price" } } }
                ]).toArray();

                res.json({ totalPayment: totalPayment[0]?.total || 0 });
            } catch (error) {
                console.error("Error fetching total payments:", error);
                res.status(500).json({ message: "Failed to calculate total payments" });
            }
        });

        // Endpoint to count total tour guides
        app.get('/admin/tourguides/count', async (req, res) => {
            try {
                const database = client.db("imtiaztourismltd");
                const collection = database.collection("tourguides");
                const allTourGuides = await collection.find({}).toArray();
                const totalTourGuides = allTourGuides.length;

                res.json({ totalTourGuides });
            } catch (error) {
                console.error('Error fetching total tour guides:', error.message);
                res.status(500).json({ message: 'Failed to count tour guides' });
            }
        });

        // Endpoint to count total packages
        app.get("/admin/packages/count", async (req, res) => {
            try {
                const database = client.db("imtiaztourismltd");
                const collection = database.collection("ourpackages");
                const allPackages = await collection.find({}).toArray();
                const totalPackages = allPackages.length;

                res.json({ totalPackages });
            } catch (error) {
                console.error("Error fetching total packages:", error);
                res.status(500).json({ message: "Failed to count packages" });
            }
        });



        // admin state
        app.get("/api/stats", async (req, res) => {
            try {
                const db = client.db("imtiaztourismltd");

                // Ensure the count operations are awaited properly
                const totalUsers = await db.collection('users').countDocuments();
                const totalTourGuides = await db.collection('tourguides').countDocuments();
                const totalStories = await db.collection('stories').countDocuments();
                const totalPackages = await db.collection('ourpackages').countDocuments();

                const stats = {
                    totalUsers: totalUsers || 0,
                    totalTourGuides: totalTourGuides || 0,
                    totalStories: totalStories || 0,
                    totalPackages: totalPackages || 0,
                };

                res.json(stats);
            } catch (error) {
                console.error("Error fetching stats:", error);
                res.status(500).json({ error: "Server error" });
            }
        });

        // Endpoint to count total clients
        app.get('/admin/clients/count', async (req, res) => {
            try {
                const database = client.db("imtiaztourismltd");
                const collection = database.collection("users");
                const allClients = await collection.find({ userRole: "Tourist" }).toArray();
                const totalClients = allClients.length;

                res.json({ totalClients });
            } catch (error) {
                console.error("Error fetching total clients:", error);
                res.status(500).json({ message: "Failed to count clients" });
            }
        });

        // Endpoint to count total stories
        app.get('/admin/stories/count', async (req, res) => {
            try {
                const database = client.db("imtiaztourismltd");
                const collection = database.collection("stories");
                const allStories = await collection.find({}).toArray();
                const totalStories = allStories.length;

                res.json({ totalStories });
            } catch (error) {
                console.error("Error fetching total stories:", error);
                res.status(500).json({ message: "Failed to count stories" });
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