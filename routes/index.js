var express = require('express');
var mongoose=require('mongoose');
var multer=require('multer');
var Grid=require('gridfs-stream');
var router = express.Router();
var {Readable}=require('stream');
var id3=require('node-id3');
var crypto=require('crypto')
var songModel=require('./songModel')


mongoose.connect('mongodb://0.0.0.0/spo2').then(result=>{
         console.log('connected to database');
}).catch(err=>{
   console.log(err);
})

var con=mongoose.connection
var gfs,gfsBucket,gfsPoster,gfsBucketPoster
con.once('open',()=>{

     gfs=Grid(con.db,mongoose.mongo)
     gfsPoster=Grid(con.db,mongoose.mongo)
     gfs.collection('poster')
     gfs.collection('audio')
     gfsBucket=new mongoose.mongo.GridFSBucket(con.db,{
         bucketName:"audio"
     })
     gfsBucketPoster=new mongoose.mongo.GridFSBucket(con.db,{
      bucketName:"poster"
    })
})

var songModel=mongoose.model('song',mongoose.Schema({
  name:String,
  poster:String,
  artist:String,
  album:String,
  title:String
}))


/* GET home page. */
router.get('/', async function(req, res, next) {

  var musics= await songModel.find()

  res.render('index',{musics});
});

const storage=multer.memoryStorage()
const upload=multer({storage:storage})

router.post('/upload',upload.array('file'),async (req,res,next)=>{

     for(let file of req.files){
    
          var fileMetaData=id3.read(file.buffer)
          var fileName=crypto.randomBytes(20).toString('hex')
          Readable.from(fileMetaData.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(fileName+'poster'))
          Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(fileName))

          var newSong=new songModel({
            name:fileName,
            poster:fileName+'poster',
            artist:fileMetaData.artist.replace(/"/,""),
            album:fileMetaData.album.replace(/"/,""),
            title:fileMetaData.title.replace(/"/,"")
          })

          await newSong.save()

    } 
     res.send('song uploaded');
})

router.get('/getPoster/:posterName',(req,res,next)=>{
  gfsBucketPoster.openDownloadStreamByName(req.params.posterName).pipe(res);
})  


router.get('/getMusic/:audioName',async (req,res,next)=>{
  var currentMusic=await gfs.files.findOne({
      filename:req.params.audioName
  })


 
  var musicSize=currentMusic.length+1;

  var range=req.headers.range
  const parts=range.replace(/bytes=/,'').split('-')
  let start=parseInt(parts[0],10)
  let end=parts[1]?parseInt(parts[1],10):musicSize-1

  const chunkSize=(end-start)+1;

  res.writeHead(206,{
     "Content-Range":`bytes ${start}-${end}/${musicSize}`,
     "Accept-Range":'bytes',
     "Content-Length":chunkSize,
     "Content-Type":'mp.3'
  })

  
  gfsBucket.openDownloadStreamByName(req.params.audioName,{
    start,end
  }
  ).pipe(res);
})

module.exports = router;
