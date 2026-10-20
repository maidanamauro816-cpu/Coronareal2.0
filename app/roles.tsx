import React from "react";
import { View, Image, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
const GOLD="#FFD700", BG="#0A0A0A";
const PNG="https://raw.githubusercontent.com/maidanamauro816-cpu/Coronareal2.0/main/";
export default function Roles(){
 const router=useRouter(); const {width,height}=useWindowDimensions();
 return <View style={s.root}>
  <Image source={{uri:PNG+"Meta_AI_02_roles_20261020_180000.png"}} resizeMode="contain" style={{width,height:height*.86}} />
  <View style={s.actions}>
   <Pressable onPress={()=>router.push("/profesional/setup")} style={s.button}><Text style={s.txt}>SOY PROFESIONAL</Text></Pressable>
   <Pressable onPress={()=>router.push("/cliente/catalogo")} style={s.button}><Text style={s.txt}>SOY CLIENTE</Text></Pressable>
  </View>
 </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:BG,alignItems:"center",justifyContent:"center"},actions:{position:"absolute",bottom:20,flexDirection:"row",gap:8},button:{borderColor:GOLD,borderWidth:1,borderRadius:10,padding:12},txt:{color:GOLD,fontWeight:"800",fontSize:12}});
