const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

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
    const userCollection = client.db("foody-client-db").collection("users");

    // JWT-token-Generator ---start
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: 60 * 60,
      });
      res.send({ token });
    });
    // verify jwt token
    // middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log(token);
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "token is invalid" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // JWT ---end

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
    // user route start----------------
    app.get("/users", async (req, res) => {
      try {
        const uses = await userCollection.find({}).toArray();
        res.status(200).json(uses);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    // new user create
    app.post("/users", async (req, res) => {
      const { name, role, email, photoURL } = req.body;
      const newUser = { name, role, email, photoURL };
      const queryEmail = { email: email };
      try {
        const existingUser = await userCollection.findOne(queryEmail);
        if (existingUser) {
          return res.status(302).json({ message: "User already exists" });
        }
        const result = await userCollection.insertOne(newUser);
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // user delete
    app.delete("/users/:id", async (req, res) => {
      try {
        const userId = req.params.id;
        const paramsId = { _id: new ObjectId(userId) };
        const result = await userCollection.deleteOne(paramsId);
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ message: "User deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    // get admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const emailQuery = { email: email };
        const user = await userCollection.findOne(emailQuery);
        // console.log(user);
        console.log(req.decoded.email);
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.status(200).json({ admin });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // make admin
    app.patch("/users/admin/:id", async (req, res) => {
      try {
        const userId = req.params.id;
        const { name, email, photoURL, role } = req.body;
        const updateUser = await userCollection.findOne(
          userId,
          {
            $set: { role: "admin" },
          },
          { new: true, runValidators: true }
        );

        if (!updateUser) {
          return res.status(404).json({ messages: "User not found" });
        }

        res.status(200).json(updateUser);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    // user route end----------------

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
