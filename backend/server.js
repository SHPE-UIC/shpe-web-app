import express from "express";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();

app.get('/', (req,res)=>{
    res.send("Testing")

});

app.listen(PORT, ()=> {

    console.log('started the server on port ${PORT}')

});