const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3000
const db = require('./queries')

const githubToken = "84f7bcba2096ad9df6f9990aa9c4dcb6e1f0460a"

app.use(bodyParser.json({limit: '50mb'}))
app.use(
    bodyParser.urlencoded({
    	limit: '50mb',
    	extended: true,
    })
)
app.use(bodyParser.json())

app.post('/login', db.loginUser)

app.post('/register', db.registerUser)

app.get('/gallery', db.getGalleryImageNames)

app.post('/validate-location', db.validateLocation)

app.post('/description', db.getNearestLocationDescription)

app.get('/locations', db.getLocationsAroundUser)

app.listen(port, '0.0.0.0', () => {
    console.log(`App running on port ${port}.`);
})