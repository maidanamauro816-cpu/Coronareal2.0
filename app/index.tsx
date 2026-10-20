import React from "react";
import { View, Image, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
const GOLD="#FFD700", BG="#0A0A0A";
const PNG="https://raw.githubusercontent.com/maidanamauro816-cpu/Coronareal2.0/main/";
export default function Splash(){
 const router=useRouter(); const {width,height}=useWindowDimensions();
 return <View style={s.root}>
  <Image source={{uri:PNG+"Meta_AI_01_splash_20261020_175954.png"}} resizeMode="contain" style={{width,height:height*.82}} />
  <Pressable accessibilityRole="button" onPress={()=>router.push("/roles")} style={s.button}><Text style={s.buttonText}>CONTINUAR</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:BG,alignItems:"center",justifyContent:"center"},button:{position:"absolute",bottom:28,borderWidth:1,borderColor:GOLD,borderRadius:12,paddingVertical:14,paddingHorizontal:42,backgroundColor:BG},buttonText:{color:GOLD,fontWeight:"800",letterSpacing:2}});
