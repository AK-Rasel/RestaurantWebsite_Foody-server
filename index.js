const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middle ware
app.use(cors());
app.use(express.json());

// mongodb config

const uri = `mongodb+srv://${process.env.SECRET_UserName}:${process.env.SECRET_Password}@cluster0.mc1hfkb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();

    // start our  code

    // database Collection------------------
    const menuCollections = client.db("foody-client-db").collection("menus");
    const cartCollections = client
      .db("foody-client-db")
      .collection("cartsItems");

    // all menus items operations--------------------
    app.get("/menu", async (req, res) => {
      const result = await menuCollections.find().toArray();
      res.send(result);
    });
    // Curd Operation------------------------------
    app.post("/carts", async (req, res) => {
      const cartItems = req.body;
      const result = await cartCollections.insertOne(cartItems);
      res.send(result);
    });

    //get cart using email
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await cartCollections.find(filter).toArray();
      res.send(result);
    });
    // cart route section--------------------------------------------start
    // get specific carts
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollections.findOne(filter);
      res.send(result);
    });
    // delete from cart items
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollections.deleteOne(filter);
      res.send(result);
    });

    // cart update with quantity
    app.put("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: { quantity: parseInt(quantity, 10) },
      };
      const result = await cartCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // cart route section--------------------------------------------end
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
