import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

const navy='#082b4d', blue='#197fb5', line='#cfe2ed', pale='#eef7fb'
const styles=StyleSheet.create({
  page:{padding:38,fontFamily:'Helvetica',fontSize:9,color:'#334e68'}, top:{height:5,backgroundColor:blue,borderRadius:3,marginBottom:18},
  header:{flexDirection:'row',justifyContent:'space-between'}, title:{fontFamily:'Helvetica-Bold',fontSize:20,color:navy}, sub:{marginTop:5,color:'#6b8296'},
  badge:{backgroundColor:navy,color:'#fff',padding:12,borderRadius:7}, badgeTitle:{fontFamily:'Helvetica-Bold',fontSize:12},
  cards:{flexDirection:'row',gap:10,marginTop:20}, card:{width:'50%',borderWidth:1,borderColor:line,borderRadius:7,padding:11}, label:{fontSize:7,color:blue,marginBottom:4}, name:{fontFamily:'Helvetica-Bold',fontSize:11,color:navy,marginBottom:4},
  table:{marginTop:20,borderWidth:1,borderColor:line,borderRadius:7,overflow:'hidden'}, row:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:line}, lastRow:{flexDirection:'row'}, cell:{width:'70%',padding:8}, amount:{width:'30%',padding:8,textAlign:'right'}, section:{backgroundColor:pale,fontFamily:'Helvetica-Bold',color:navy,padding:8},
  total:{marginTop:14,backgroundColor:navy,color:'#fff',padding:14,borderRadius:7,flexDirection:'row',justifyContent:'space-between'}, totalValue:{fontFamily:'Helvetica-Bold',fontSize:17},
  footer:{position:'absolute',bottom:35,left:38,right:38,borderTopWidth:1,borderTopColor:line,paddingTop:10,fontSize:7,color:'#6b8296'},
})
const fmt=(value:number)=>value.toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})

type Props={ business:{name:string;address:string|null}; employee:{firstName:string;lastName:string;position:string|null;cnp:string|null;iban:string|null}; run:{month:string}; line:{workingDays:number;workedDays:number;vacationDays:number;medicalDays:number;baseGross:number;attendanceGross:number;overtimeAmount:number;bonuses:number;medicalAllowance:number;taxableBenefits:number;mealTickets:number;grossIncome:number;cas:number;cass:number;incomeTax:number;otherDeductions:number;advancePaid:number;netSalary:number} }

export function PayslipPdf({business,employee,run,line}:Props){
  const earnings=[['Salariu brut contractual',line.baseGross],['Brut aferent pontajului',line.attendanceGross],['Ore suplimentare',line.overtimeAmount],['Prime / bonusuri',line.bonuses],['Indemnizatie concediu medical',line.medicalAllowance],['Avantaje impozabile',line.taxableBenefits],['Tichete de masa',line.mealTickets]].filter(([,value])=>Number(value)!==0)
  const deductions=[['CAS',line.cas],['CASS',line.cass],['Impozit pe venit',line.incomeTax],['Alte retineri',line.otherDeductions],['Avans platit',line.advancePaid]].filter(([,value])=>Number(value)!==0)
  return <Document><Page size="A4" style={styles.page}><View style={styles.top}/><View style={styles.header}><View><Text style={styles.title}>Fluturas de salariu</Text><Text style={styles.sub}>{business.name}</Text></View><View style={styles.badge}><Text style={{fontSize:7}}>LUNA</Text><Text style={styles.badgeTitle}>{run.month}</Text></View></View>
    <View style={styles.cards}><View style={styles.card}><Text style={styles.label}>ANGAJAT</Text><Text style={styles.name}>{employee.lastName.toUpperCase()} {employee.firstName}</Text><Text>CNP: {employee.cnp||'-'}</Text><Text>Functie: {employee.position||'-'}</Text><Text>IBAN: {employee.iban||'-'}</Text></View><View style={styles.card}><Text style={styles.label}>PONTAJ</Text><Text>Zile lucratoare: {line.workingDays}</Text><Text>Zile lucrate: {line.workedDays}</Text><Text>Concediu odihna: {line.vacationDays}</Text><Text>Concediu medical: {line.medicalDays}</Text></View></View>
    <View style={styles.table}><Text style={styles.section}>VENITURI</Text>{earnings.map(([label,value],index)=><View style={index===earnings.length-1?styles.lastRow:styles.row} key={String(label)}><Text style={styles.cell}>{label}</Text><Text style={styles.amount}>{fmt(Number(value))} lei</Text></View>)}<Text style={styles.section}>RETINERI</Text>{deductions.map(([label,value],index)=><View style={index===deductions.length-1?styles.lastRow:styles.row} key={String(label)}><Text style={styles.cell}>{label}</Text><Text style={styles.amount}>{fmt(Number(value))} lei</Text></View>)}</View>
    <View style={styles.total}><View><Text style={{fontSize:7}}>VENIT BRUT</Text><Text>{fmt(line.grossIncome)} lei</Text></View><View><Text style={{fontSize:7}}>NET DE PLATA</Text><Text style={styles.totalValue}>{fmt(line.netSalary)} lei</Text></View></View>
    <Text style={styles.footer}>Document generat din statul de salarii finalizat. Fluturasul are caracter informativ si contine date personale; transmiteti-l numai salariatului vizat.</Text></Page></Document>
}
