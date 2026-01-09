{
  "versionEsquema": "25.1.0",
  "guardadoEl": "2025-12-15T19:48:52.639Z",
  "generadoParaPDF": "2025-12-28T10:30:00.000Z",
  
  "beneficiario": {
    "nombre": "Víctor Manuel Viñuales Guillén",
    "dni": "03864429S",
    "entidad": "Universidad de Huelva",
    "categoria": "IP"
  },
  
  "pago": {
    "tipo": "TJ",
    "tipoLabel": "Tarjeta de crédito corporativa",
    "tarjeta": "1234 1234 1234 1234 123"
  },
  
  "proyecto": {
    "tipo": "G24",
    "tipoLabel": "Proyecto de investigación (Convocatorias a partir de 2024)",
    "responsable": "Catalina López Bautista",
    "organica": "18.23.56.FA",
    "referencia": "GR248959",
    "normativa": "decreto"
  },
  
  "desplazamientos": [
    {
      "id": 1,
      "fechaIda": "05/06/25",
      "horaIda": "10:00",
      "fechaRegreso": "05/06/25",
      "horaRegreso": "23:00",
      "ticketCena": true,
      "origen": "Badajoz",
      "destino": "Madrid",
      "paisDestino": "España",
      "paisDestinoIndex": 0,
      "cruceIda": "",
      "cruceVuelta": "",
      "motivo": "Reunión del grupo de investigación",
      "km": "388 km",
      "alojamiento": "100,00 €",
      "noManutencion": false,
      "otrosGastos": [],
      
      "calculos": {
        "esInternacional": false,
        "residenciaEventual": false,
        "factorResidencia": 1,
        
        "totales": {
          "manutencion": 53.34,
          "manutencionBase": 53.34,
          "alojamientoMax": 102.56,
          "alojamientoMaxBase": 102.56,
          "alojamientoUser": 100.00,
          "km": 100.88,
          "otrosGastos": 0.00,
          "total": 254.22,
          "irpfSujeto": 53.34,
          "noches": 1
        },
        
        "detalles": {
          "manutenciones": 1,
          "precioManutencion": 53.34,
          "noches": 1,
          "precioNoche": 102.56,
          "km": 388,
          "precioKm": 0.26
        },
        
        "segmentos": null,
        
        "ui": {
          "alojamientoExcedeMax": false,
          "nochesAmbiguas": false,
          "nochesAmbiguasRango": null,
          "precioNocheMedio": 102.56
        }
      }
    },
    {
      "id": 2,
      "fechaIda": "01/01/25",
      "horaIda": "10:00",
      "fechaRegreso": "05/01/25",
      "horaRegreso": "23:00",
      "ticketCena": false,
      "origen": "Mérida",
      "destino": "Tokio",
      "paisDestino": "Japón",
      "paisDestinoIndex": 87,
      "cruceIda": "01/01/25",
      "cruceVuelta": "04/01/25",
      "motivo": "Ir de turismo",
      "km": "100 km",
      "alojamiento": "427,62 €",
      "noManutencion": false,
      "otrosGastos": [
        {
          "tipo": "AVN",
          "tipoLabel": "Avión",
          "concepto": "Avión de Madrid a Tokio",
          "importe": "1.000,00 €",
          "importeNumerico": 1000.00
        },
        {
          "tipo": "TAX",
          "tipoLabel": "Taxi",
          "concepto": "Taxi hotel",
          "importe": "200,00 €",
          "importeNumerico": 200.00
        }
      ],
      
      "calculos": {
        "esInternacional": true,
        "residenciaEventual": false,
        "factorResidencia": 1,
        
        "totales": {
          "manutencion": 507.78,
          "manutencionBase": 507.78,
          "alojamientoMax": 729.24,
          "alojamientoMaxBase": 729.24,
          "alojamientoUser": 427.62,
          "km": 26.00,
          "otrosGastos": 1200.00,
          "total": 2161.40,
          "irpfSujeto": 373.12,
          "noches": 4
        },
        
        "detalles": null,
        
        "segmentos": [
          {
            "titulo": "España (ida): 01/01 - 01/01",
            "pais": "España",
            "manutenciones": 0.5,
            "manutencionAmount": 26.67,
            "precioManutencion": 53.34,
            "noches": 0,
            "nochesAmount": 0.00,
            "precioNoche": 102.56,
            "nochesAmbiguous": false
          },
          {
            "titulo": "Japón: 01/01 - 04/01",
            "pais": "Japón",
            "manutenciones": 4,
            "manutencionAmount": 454.44,
            "precioManutencion": 113.61,
            "noches": 3,
            "nochesAmount": 546.93,
            "precioNoche": 182.31,
            "nochesAmbiguous": false
          },
          {
            "titulo": "España (vuelta): 04/01 - 05/01",
            "pais": "España",
            "manutenciones": 0.5,
            "manutencionAmount": 26.67,
            "precioManutencion": 53.34,
            "noches": 1,
            "nochesAmount": 102.56,
            "precioNoche": 102.56,
            "nochesAmbiguous": false
          }
        ],
        
        "ui": {
          "alojamientoExcedeMax": false,
          "nochesAmbiguas": false,
          "nochesAmbiguasRango": null,
          "precioNocheMedio": 182.31
        }
      }
    }
  ],
  
  "desplazamientoEspecial": {
    "lineas": [
      { "tipo": "seccion", "descripcion": "Sección 1" },
      { "tipo": "normal", "descripcion": "Gasto 1", "importe": "", "cantidad": "", "total": "500,00 €", "totalNumerico": 500.00 },
      { "tipo": "normal", "descripcion": "Gasto 2", "importe": "50,00 €", "cantidad": "3", "total": "150,00 €", "totalNumerico": 150.00 }
    ],
    "irpf": "50,00 €",
    "irpfNumerico": 50.00,
    "totalNumerico": 650.00
  },
  
  "vehiculo": {
    "tipo": "coche",
    "tipoLabel": "Coche",
    "marca": "Seat",
    "modelo": "León",
    "matricula": "1951GHP",
    "justificarPernocta": false
  },
  
  "evento": {
    "nombre": "Congreso de Aprender Cosas 2025",
    "lugar": "Tokio",
    "fechaDesde": "02/01/25",
    "fechaHasta": "03/08/25",
    "gastosInscripcion": "200,00 €",
    "gastosInscripcionNumerico": 200.00,
    "comidasIncluidas": 2,
    "desplazamientoAsociado": "desp1",
    "descuentoManutencionCalculado": 53.34
  },
  
  "honorarios": {
    "importe": "1.000,00 €",
    "importeNumerico": 1000.00,
    "beneficiario": "NOUEX",
    "beneficiarioLabel": "No UEx",
    "situacion": "PDIJU",
    "situacionLabel": "PDI Jubilado",
    "concepto": "Haber trabajado muchísimo en esos dos días."
  },
  
  "imputacion": [
    { "organica": "18.23.56.FA", "responsable": "Catalina López Bautista", "importe": 2600, "readonly": true },
    { "organica": "18.23.00", "responsable": "Paula Viñuales López", "importe": 500, "readonly": false }
  ],
  
  "ajustes": {
    "financiacionMaxima": "3.100,00 €",
    "financiacionMaximaNumerico": 3100.00,
    "descuentos": [
      { "tipo": "MNT", "tipoLabel": "Manutención", "motivo": "Por abaratar", "importe": "100,00 €", "importeNumerico": 100.00 },
      { "tipo": "ALJ", "tipoLabel": "Alojamiento", "motivo": "50 eurillos menos", "importe": "50,00 €", "importeNumerico": 50.00 }
    ]
  },
  
  "resultados": {
    "totalesDesplazamientos": {
      "manutencion": 561.12,
      "alojamiento": 527.62,
      "kilometraje": 126.88,
      "otrosGastos": 1200.00,
      "irpfSujeto": 426.46
    },
    
    "descuentosAgrupados": {
      "TOT": 0.00,
      "MNT": 100.00,
      "ALJ": 50.00,
      "KLM": 0.00,
      "OTR": 0.00
    },
    
    "descuentoCongreso": 53.34,
    
    "netos": {
      "manutencion": 407.78,
      "alojamiento": 477.62,
      "kilometraje": 126.88,
      "otrosGastos": 1200.00
    },
    
    "subtotales": {
      "desplazamientosNormales": 2212.28,
      "desplazamientoEspecial": 650.00,
      "gastosInscripcion": 200.00,
      "honorarios": 1000.00
    },
    
    "totalAntesFinanciacion": 4062.28,
    "descuentoFinanciacionMaxima": 962.28,
    
    "totalLiquidacion": 3100.00,
    "irpfTotal": 1426.46
  }
}