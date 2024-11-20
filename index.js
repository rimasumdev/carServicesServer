const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");

// Load environment variables
dotenv.config();

// middleware
app.use(cors());
app.use(express.json());

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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const serviceCollection = client.db("carDB").collection("services");
    const orderCollection = client.db("carDB").collection("orders");

    app.get("/services", async (req, res) => {
      const result = await serviceCollection.find().toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      // console.log(result);
      res.send(result);
    });

    // orders
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      console.log(result);
      res.send(result);
    });

    // get orders
    app.get("/orders", async (req, res) => {
      console.log(req.query);
      const email = req.query.email;
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // update order
    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      console.log(id, status);
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
