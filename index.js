const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

// Load environment variables
dotenv.config();

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["set-cookie"],
  })
);
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(helmet());

// connect to database
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.PASSWORD}@cluster0.3sfpc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verify JWT middleware function
const verifyJWT = (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access by token" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access by token" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const serviceCollection = client.db("carDB").collection("services");
    const orderCollection = client.db("carDB").collection("orders");

    // jwt token
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        if (!user.email) {
          return res
            .status(400)
            .send({ error: true, message: "Invalid request" });
        }

        const token = jwt.sign(
          { email: user.email },
          process.env.ACCESS_TOKEN_SECRET,
          {
            expiresIn: "1h",
            algorithm: "HS256",
          }
        );

        res
          .cookie("access_token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 60 * 60 * 1000,
          })
          .send({ success: true });
      } catch (error) {
        res.status(500).send({ error: true });
      }
    });

    // logout
    app.post("/logout", (req, res) => {
      res.clearCookie("access_token", { maxAge: 0 }).send({ success: true });
    });

    // services

    app.get("/services", async (req, res) => {
      try {
        const searchTerm = req.query.search || "";
        let query = {
          $or: [
            { title: { $regex: searchTerm, $options: "i" } },
            { service_id: { $regex: searchTerm, $options: "i" } },
            { price: { $regex: searchTerm, $options: "i" } },
            { description: { $regex: searchTerm, $options: "i" } },
            // Convert ObjectId to string and then search
            {
              $expr: {
                $regexMatch: {
                  input: { $toString: "$_id" },
                  regex: searchTerm,
                  options: "i",
                },
              },
            },
          ],
        };
        // console.log(query);
        const result = await serviceCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: true, message: "Failed to fetch services" });
      }
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // orders
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;
        const result = await orderCollection.insertOne(order);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: true, message: "Failed to create order" });
      }
    });

    // get orders
    app.get("/orders", verifyJWT, async (req, res) => {
      // const emails = {
      //   decodedEmail: req.decoded.email,
      //   queryEmail: req.query.email,
      // };
      // console.log("Emails", emails);
      const email = req.query.email;
      if (!email) {
        return res
          .status(401)
          .send({ error: true, message: "Unauthorized access by email" });
      }
      if (req.decoded.email !== email) {
        return res
          .status(401)
          .send({ error: true, message: "Unauthorized access by email" });
      }
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // update order
    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      // console.log(id, status);
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: status } };
      const result = await orderCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // delete order
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// routes
app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

if (
  !process.env.ACCESS_TOKEN_SECRET ||
  !process.env.USER_NAME ||
  !process.env.PASSWORD
) {
  console.error("Required environment variables are missing");
  process.exit(1);
}
