const Pool = require('pg').Pool
const fs = require("fs")
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const SALT_ROUNDS = 10;
const MEDIA_ROOT = './media/'

const pool = new Pool({
  user: 'svoboda',
  host: 'localhost',
  database: 'svoboda',
  password: 'svoboda',
  port: 5432,
})


/*
    Endpoint for validation pictures the users has taken
*/
const validateLocation = (request, response) => {
    let sessId = request.body.sessId;
    let currentLocationLat = request.body.currentLocationLat;
    let currentLocationLng = request.body.currentLocationLng;
    let leftBoundryPointLat = request.body.leftBoundryPointLat;
    let leftBoundryPointLng = request.body.leftBoundryPointLng;
    let rightBoundryPointLat = request.body.rightBoundryPointLat;
    let rightBoundryPointLng = request.body.rightBoundryPointLng;
    let base64Data = request.body.pic.replace(/^data:image\/png;base64,/, "")

    /* 
        Get closes location to the users current location thats within the polygon.
        We use the ST_contains function provided by the Postgis extension
        the check wherher a location is in the polygon. Then with the <-> operator we 
        calculate the distance between two points and return the closest one.
    */
    pool.query(`
        WITH 
            polygon AS (SELECT ST_MakePolygon(ST_GeomFromText('LINESTRING(${currentLocationLng} ${currentLocationLat}, ${leftBoundryPointLng} ${leftBoundryPointLat}, ${rightBoundryPointLng} ${rightBoundryPointLat}, ${currentLocationLng} ${currentLocationLat})', 4326))),
            center AS (SELECT ST_SetSRID(ST_MakePoint(${currentLocationLng},${currentLocationLat}), 4326)),
            locs AS (SELECT *
                FROM location
                WHERE ST_Contains((select * from polygon limit 1), lnglat) is TRUE)
        SELECT *
        FROM locs
        ORDER BY locs.lnglat <-> (SELECT ST_SetSRID(ST_MakePoint(${currentLocationLng},${currentLocationLat}), 4326))
        LIMIT 1
        `, (error, results) => {
            if (error) {
                console.log(error)
                response.status(500)
                return response.end("Server error")
            }
            if (results.rows.length == 0) {
                response.status(404)
                return response.end()
            }
            else {
                let closestLocation = results.rows[0];
                /* 
                    Get the user id with the provided session id
                */
                pool.query(`
                    SELECT id 
                    FROM profile
                    WHERE sess_id = '${sessId}'
                `, (error, results) => {
                    if (error) {
                        console.log(error)
                        response.status(500)
                        return response.end("Server error")
                    }
                    /* 
                        Try to find out if the user has already found
                        this location before by checking if it is in his gallery.
                    */
                    if (results.rows.length != 0) {
                        let profileId = results.rows[0].id;
                        let closestLocationId = closestLocation.id;
                        pool.query(`
                            SELECT * 
                            FROM gallery
                            WHERE profile_id = '${profileId}'
                            AND location_id = '${closestLocationId}'
                        `, (error, results) => {
                            if (error) {
                                console.log(error)
                                response.status(500)
                                return response.end("Server error")
                            }
                            /* 
                                We create or update the picture received 
                                from the user. Here we save it locally for the 
                                server to use.
                            */
                            fs.writeFile(`${MEDIA_ROOT}${profileId}-${closestLocation.id}.jpg`, base64Data, 'base64', function (err) {
                                if (err)
                                {
                                    console.log('err');
                                }
                            })
                            let epochString = (new Date).getTime().toString()
                            let pictureName = closestLocation.name + epochString + '.jpg'
                            /* 
                                Insert the location in the users gallery if the user has
                                found this location for the first time otherwise it updates
                                the picture_name in the gallery
                            */
                            pool.query(`
                                INSERT INTO gallery (profile_id, location_id, picture_name)
                                VALUES ('${profileId}', '${closestLocationId}', '${pictureName}')
                                ON CONFLICT (profile_id, location_id) 
                                DO UPDATE SET picture_name = '${pictureName}'
                            `, (error, results) => {
                                if (error) {
                                    console.log(error)
                                    response.status(500)
                                    return response.end("Server error")
                                }
                                /* 
                                    Return the picture_name of the location
                                    so the adroid app can save the 
                                    taken picture with the returned name
                                */
                                response.setHeader('Content-Type', 'application/json')
                                response.status(200)
                                return response.end(
                                    JSON.stringify(
                                        {
                                            'location_name': closestLocation.name,
                                            'picture_name': pictureName
                                        }
                                ))
                            })
                        })
                    }
                })
            }
        }
    ) 
}

/*
    Endpoint to get the description for the location the
    user is facing. For now it just returs a success response
    if a location is within the bounds of the polygon. Otherwise 
    return a fail respons. On success we show the default 
    description on the android app.
*/
const getNearestLocationDescription = (request, response) => {
    let currentLocationLat = request.body.currentLocationLat;
    let currentLocationLng = request.body.currentLocationLng;
    let leftBoundryPointLat = request.body.leftBoundryPointLat;
    let leftBoundryPointLng = request.body.leftBoundryPointLng;
    let rightBoundryPointLat = request.body.rightBoundryPointLat;
    let rightBoundryPointLng = request.body.rightBoundryPointLng;

    /* 
        Get closes location to the users current location thats within the polygon.
        We use the ST_contains function provided by the Postgis extension
        the check wherher a location is in the polygon. Then with the <-> operator we 
        calculate the distance between two points and return the closest one.
    */
    pool.query(`
        WITH 
            polygon AS (SELECT ST_MakePolygon(ST_GeomFromText('LINESTRING(${currentLocationLng} ${currentLocationLat}, ${leftBoundryPointLng} ${leftBoundryPointLat}, ${rightBoundryPointLng} ${rightBoundryPointLat}, ${currentLocationLng} ${currentLocationLat})', 4326))),
            center AS (SELECT ST_SetSRID(ST_MakePoint(${currentLocationLng},${currentLocationLat}), 4326)),
            locs AS (SELECT *
                FROM location
                WHERE ST_Contains((select * from polygon limit 1), lnglat) is TRUE)
        SELECT *
        FROM locs
        ORDER BY locs.lnglat <-> (SELECT ST_SetSRID(ST_MakePoint(${currentLocationLng},${currentLocationLat}), 4326))
        LIMIT 1
        `, (error, results) => {
            if (error) {
                console.log(error)
                response.status(500)
                return response.end("Server error")
            }
            if (results.rows.length == 0) {
                response.status(404)
                return response.end()
            }
            else {
                response.status(200)
                return response.end()
            }
        }
    ) 
}

/*
    Endpoint for getting all locations in a radius of 500 metres around the user.
*/
const getLocationsAroundUser = (request, response) => {
    let user_id = request.query.user_id;
    let currentLocationLat = request.query.lat
    let currentLocationLng = request.query.lng
    let radius = 500
    /*
        We query the database to get all locations areound the user in a
        500 metre radius using the ST_DWithin function provided by the Postgis
        extension. For all found locations we return the latitude, longitude,
        the locations name, the name of the picture the user has taken (if there is one)
        and whether the location is found or not
    */
    pool.query(`
        SELECT ST_Y(l.lnglat) AS lat, ST_X(l.lnglat) AS lng, l.name, 
        case when g.picture_name is NULL then '' else g.picture_name end as picture_name,
        case when l.id IN (select location_id from gallery where profile_id=${user_id}) then true else false end as found
        FROM location AS l
        LEFT OUTER JOIN gallery AS g
        ON l.id = g.location_id
        WHERE ST_DWithin(lnglat::geography, ST_SetSRID(ST_MakePoint(${currentLocationLng},${currentLocationLat}), 4326)::geography, ${radius}) is TRUE
        `, (error, results) => {
            if (error) {
                console.log(error)
                response.status(500)
                return response.end("Server error")
            }
            response.setHeader('Content-Type', 'application/json')
            response.status(200)
            return response.end(JSON.stringify(results.rows))
        }
    ) 
}

/*
    function for base64 encoding of image files
*/
function base64_encode(file) {
    let bitmap = fs.readFileSync(file);
    return new Buffer.from(bitmap).toString('base64');
}

/*
    we use this to generate a random session_id for the user
*/
function randU64Sync() {
    return crypto.randomBytes(64).toString('hex');
}

/*
    Endpoint for user sign in.
*/
const loginUser = (request, response) => {
    let username = request.body.username;
    let password = request.body.password;
    let sess_id = request.body.sess_id;
    if (sess_id) {
        /*
            If a session id is provided try to log the user in
            with the session id. If a user is found in the 
            database with the provided session id the
            login is successful and we return the users 
            data as json to be stored on the android app.
            If the login was unsuccessful we return an error 
            message with the appropriate status code.
        */
        pool.query(`
            SELECT id, username, profile_pic, sess_id
            FROM profile
            WHERE sess_id = '${sess_id}'
            `, (error, results) => {
                if (error) {
                    console.log(error)
                    response.status(500)
                    return response.end("Server error")
                }
                if (results.rows.length == 0) {                    
                    response.status(404);
                    return response.end()
                }
                let userProfile = results.rows[0]
                userProfile.profile_pic = base64_encode(userProfile.profile_pic)
                response.setHeader('Content-type', 'application/json')
                return response.end(JSON.stringify(userProfile))
            }
        )
    }
    else {
        /*
            If the user didnt provide a session id try to log
            them in with username and password. If a user is found
            in the database with the provided username and password
            the login was successful. We then generate a session id
            for the user and save it in the database. We return the
            session id along with the users data to be stored
            on the android app. If the login was unsuccessful we return 
            an error message with the appropriate status code.
        */
        pool.query(`
            SELECT *
            FROM profile
            WHERE username = '${username}'
            `, (error, results) => {
                if (error) {
                    console.log(error);    
                    response.status(500)
                    return response.end("Server error")            
                }
                // no profile found
                if (results.rows.length == 0) {
                    response.status(401)
                    return response.end("Wrong username")
                }
                else {
                    let profile = results.rows[0];
                    sess_id = randU64Sync();
                    if (bcrypt.compareSync(password, profile.password)) {
                        pool.query(`
                            UPDATE profile
                            SET sess_id = '${sess_id}'
                            WHERE username = '${profile.username}'
                            RETURNING id, username, profile_pic, sess_id
                            `, (error, results) => {
                                if (error) {
                                    console.log(error);    
                                    response.status(500)
                                    response.end("Server error") 
                                }
                                let userProfile = results.rows[0]
                                userProfile.profile_pic = base64_encode(userProfile.profile_pic)                
                                response.setHeader('Content-type', 'application/json')
                                response.status(200)
                                return response.end(JSON.stringify(userProfile))
                            }
                        )
                    }
                    else {
                        response.status(401)
                        return response.end("Wrong password")
                    }
                }
            }
        )
    }
}

/*
    Endpoint for user registration. Note that the android app does not
    yet provide registration as an option, so the only way to insert 
    new users is doing it by hand with SQL queries or with a tool
    such as Postman to make a registration request to the server along 
    with the users registration data. 
*/
const registerUser = (request, response) => {
    let username = request.body.username;
    let password = request.body.password;
    let sess_id = randU64Sync()
    let expire_date = new Date()
    expire_date.setDate(expire_date.getDate() + 7)
    bcrypt.genSalt(SALT_ROUNDS, (err, salt) => {
        bcrypt.hash(password, salt, (err, hash) => {
            pool.query(`
                INSERT INTO profile (username, password, salt, profile_pic, sess_id ,expire_date)
                VALUES ('${username}', '${hash}', '${salt}', '${MEDIA_ROOT}out.png', '${sess_id}', current_date + interval '7 days')
                RETURNING profile.sess_id
                `, (error, results) => {
                    if (error) {
                        console.log(error);                            
                        if (typeof error.constraint !== undefined) {
                            response.status(409)
                            return response.end("User with this username already exists")                            
                        }
                        else {
                            response.status(500)
                            return response.end("Server error")  
                        } 
                    }
                    response.setHeader('Content-type', 'application/json')
                    response.status(201)
                    return response.end(JSON.stringify(results.rows[0]))
                }
            )

        })
    })    
}

/*
    Endpoint for getting the image names in the users gallery.
*/
const getGalleryImageNames = (request, response) => {
    let sessId = request.query.sessId;
    /*
        First we try to find the user with the provided session id.
        If a session id is not provide an error message is sent with
        the appropriate status code.
    */
    pool.query(`
        SELECT id 
        FROM profile
        WHERE sess_id = '${sessId}'
    `, (error, results) => {
        if (error) {
            console.log(error);    
            response.status(500)
            response.end("Server error") 
        }
        let profileId = results.rows[0].id;
        /*
            We get all the picture names in the users gallery.
            We get them in descending order so we get the last picture
            the user has taken as the first one, so that it can be displayed
            as the title image in the users gallery on the android app.
        */
        pool.query(`
            SELECT picture_name 
            FROM gallery
            WHERE profile_id = '${profileId}'
            ORDER BY id DESC
        `, (error, results) => {
            if (error) {
                console.log(error);    
                response.status(500)
                response.end("Server error") 
            }
            response.setHeader('Content-type', 'application/json')
            response.status(200)
            let pictureNames = []
            for (let location in results.rows) {
                pictureNames.push(results.rows[location]['picture_name'])
            }
            return response.end(JSON.stringify(
                {'images':pictureNames}
            ))
        })
    })
}



module.exports = {
    loginUser,
    registerUser,
    getGalleryImageNames,
    validateLocation,
    getLocationsAroundUser,
    getNearestLocationDescription
}