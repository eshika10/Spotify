const mongoose=require('mongoose')

var songSchema=mongoose.Schema({
    name:String,
    poster:String,
    artist:String,
    album:String,
    title:String
})

module.exports=mongoose.model('songModel',songSchema)