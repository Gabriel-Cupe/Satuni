const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Contraseña para autenticación
const PASSWORD = "123Jandy!";

// Archivo para almacenar usuarios
const USERS_FILE = 'users.json';

// Rutas disponibles
const AVAILABLE_ROUTES = ['Ate', 'Norte', 'Puente Piedra', 'Sur'];

// Cargar usuarios desde archivo
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error("Error loading users:", error);
    }
    return [];
}

// Guardar usuarios en archivo
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error("Error saving users:", error);
        return false;
    }
}

// Función para recargar la página
async function recargarPagina(page) {
    console.log("🔄 Recargando página...");
    try {
        await page.reload({ waitUntil: 'networkidle2' });
        await page.waitForSelector('#name', { timeout: 30000 });
        console.log("✓ Página recargada exitosamente");
        return true;
    } catch (error) {
        console.error("❌ Error al recargar página:", error);
        return false;
    }
}

// Función principal de automatización para un usuario CON REINTENTOS
// Función principal de automatización para un usuario CON REINTENTOS
async function runAutomationForUser(userData) {
    let browser = null;
    let page = null;
    const maxIntentos = 10;
    let intentos = 0;
    let exito = false;
    let resultadoFinal = null;

    try {
        console.log(`🚀 Iniciando navegador para: ${userData.name}`);
        browser = await puppeteer.launch({
            headless: false,
            args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
        });

        page = await browser.newPage();
        
        // Navegar al sitio
        console.log(`⏳ Navegando a arruni.org para: ${userData.name}`);
        await page.goto('https://arruni.org', { waitUntil: 'networkidle2' });

        while (intentos < maxIntentos && !exito) {
            intentos++;
            console.log(`\n🎯 INTENTO ${intentos} de ${maxIntentos} para: ${userData.name}`);
            console.log("=".repeat(50));
            
            try {
                // Esperar a que el formulario cargue
                console.log(`⏳ Esperando formulario para: ${userData.name}`);
                await page.waitForSelector('#name', { timeout: 30000 });
                
                // Llenar formulario
                console.log(`📝 Llenando formulario para: ${userData.name}`);
                await page.type('#name', userData.name);
                await page.type('#last_name', userData.last_name);
                await page.type('#code', userData.code);
                await page.type('#phone', userData.phone);
                
                // Seleccionar facultad
                await page.select('#faculty', userData.faculty);
                
                // Esperar opciones de ruta
                console.log(`⏳ Esperando rutas para: ${userData.name}`);
                try {
                    await page.waitForSelector('.route-option', { timeout: 10000 });
                } catch (error) {
                    console.log("❌ No se cargaron las rutas, recargando...");
                    await recargarPagina(page);
                    continue;
                }
                
                // Buscar y seleccionar ruta especificada
                console.log(`🔍 Buscando ruta ${userData.route} para: ${userData.name}`);
                const routeOptions = await page.$$('.route-option');
                
                let rutaEncontrada = false;
                let rutaDisponible = false;
                
                for (const option of routeOptions) {
                    try {
                        const optionText = await page.evaluate(el => el.textContent, option);
                        if (optionText.includes(userData.route)) {
                            rutaEncontrada = true;
                            const inputDisabled = await option.$eval('input', el => el.disabled);
                            
                            if (!inputDisabled) {
                                await option.click();
                                console.log(`✓ Ruta ${userData.route} seleccionada para: ${userData.name}`);
                                rutaDisponible = true;
                                break;
                            } else {
                                console.log(`❌ Ruta ${userData.route} llena/deshabilitada para: ${userData.name}`);
                                break;
                            }
                        }
                    } catch (error) {
                        continue;
                    }
                }
                
                if (!rutaEncontrada) {
                    console.log(`❌ Ruta ${userData.route} no encontrada, recargando...`);
                    await recargarPagina(page);
                    continue;
                }
                
                if (!rutaDisponible) {
                    console.log(`❌ Ruta ${userData.route} no disponible, recargando...`);
                    await recargarPagina(page);
                    continue;
                }
                
                // Hacer clic en Registrar
                console.log(`🖱️ Haciendo clic en Registrar para: ${userData.name}`);
                let clicExitoso = false;
                
                try {
                    const submitButton = await page.$('button[type="submit"]');
                    if (submitButton) {
                        await submitButton.click();
                        clicExitoso = true;
                    } else {
                        // Intentar otros selectores
                        const buttons = await page.$$('button');
                        for (const button of buttons) {
                            const buttonText = await page.evaluate(el => el.textContent, button);
                            if (buttonText.includes('Registrar')) {
                                await button.click();
                                clicExitoso = true;
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.log("❌ Error al hacer clic en Registrar, recargando...");
                    await recargarPagina(page);
                    continue;
                }
                
                if (!clicExitoso) {
                    console.log("❌ No se pudo encontrar el botón Registrar, recargando...");
                    await recargarPagina(page);
                    continue;
                }
                
                // Esperar y verificar resultado
                console.log(`⏳ Esperando confirmación para: ${userData.name}`);
                
                // Esperar a que aparezca algún resultado
                try {
                    await page.waitForSelector('.fixed.inset-0, .bg-red-50, .bg-green-50', { timeout: 10000 });
                } catch (error) {
                    console.log("❌ No se detectó respuesta después de registrar, recargando...");
                    await recargarPagina(page);
                    continue;
                }
                
                // Verificar si fue exitoso (ticket de reserva)
                const ticketElement = await page.$('.fixed.inset-0');
                if (ticketElement) {
                    console.log(`🎉 Ticket de reserva detectado para: ${userData.name}`);
                    
                    // Obtener número de ticket
                    let ticketNumber = "No encontrado";
                    try {
                        const ticketNumberElement = await page.$('.ticket-number');
                        if (ticketNumberElement) {
                            ticketNumber = await page.evaluate(el => el.textContent, ticketNumberElement);
                        }
                    } catch (error) {
                        console.log("No se pudo obtener el número de ticket");
                    }
                    
                    resultadoFinal = { 
                        success: true, 
                        message: `Reserva exitosa - Ticket: ${ticketNumber}`,
                        intentos: intentos
                    };
                    exito = true;
                    break;
                }
                
                // Verificar si hay error de ruta no seleccionada
                const errorElement = await page.$('.bg-red-50');
                if (errorElement) {
                    const errorText = await page.evaluate(el => el.textContent, errorElement);
                    console.log(`❌ Error detectado: ${errorText}`);
                    
                    if (errorText.includes('selecciona una ruta')) {
                        console.log("Recargando por error de ruta...");
                        await recargarPagina(page);
                        continue;
                    }
                }
                
                // Si no se detectó ninguno de los elementos esperados, recargar
                console.log("❌ No se detectó resultado claro, recargando...");
                await recargarPagina(page);
                
            } catch (error) {
                console.error(`💥 Error en intento ${intentos} para ${userData.name}:`, error);
                await recargarPagina(page);
            }
        }
        
    } catch (error) {
        console.error(`💥 Error general para ${userData.name}:`, error);
    } finally {
        // Esperar 5 segundos antes de cerrar el navegador
        if (browser) {
            console.log(`⏳ Esperando 5 segundos antes de cerrar...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            await browser.close();
        }
    }
    
    if (!exito) {
        console.log(`❌ Se agotaron los ${maxIntentos} intentos para: ${userData.name}`);
        resultadoFinal = { 
            success: false, 
            message: `Se agotaron los ${maxIntentos} intentos sin éxito`,
            intentos: intentos
        };
    }
    
    return resultadoFinal;
}

// Función para ejecutar automatización en paralelo
async function runAutomationInParallel(users) {
    const promises = users.map(user => runAutomationForUser(user));
    return Promise.all(promises);
}

// Rutas de la API (se mantienen igual que antes)
// ... (el resto del código de rutas API se mantiene igual)

// Verificar contraseña
app.post('/api/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Contraseña incorrecta' });
    }
});

// Obtener usuarios
app.get('/api/users', (req, res) => {
    const users = loadUsers();
    res.json(users);
});

// Obtener rutas disponibles
app.get('/api/routes', (req, res) => {
    res.json(AVAILABLE_ROUTES);
});

// Agregar usuario
app.post('/api/users', (req, res) => {
    const newUser = req.body;
    const users = loadUsers();
    
    // Verificar si el usuario ya existe
    if (users.some(user => user.code === newUser.code)) {
        return res.status(400).json({ success: false, message: 'El usuario ya existe' });
    }
    
    users.push(newUser);
    if (saveUsers(users)) {
        res.json({ success: true, user: newUser });
    } else {
        res.status(500).json({ success: false, message: 'Error al guardar usuario' });
    }
});

// Eliminar usuario
app.delete('/api/users/:code', (req, res) => {
    const userCode = req.params.code;
    let users = loadUsers();
    
    const initialLength = users.length;
    users = users.filter(user => user.code !== userCode);
    
    if (users.length < initialLength && saveUsers(users)) {
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
});

// Ejecutar automatización para un usuario
app.post('/api/run-automation', async (req, res) => {
    try {
        const userData = req.body;
        console.log(`📨 Solicitando reserva para: ${userData.name} ${userData.last_name}`);
        
        const result = await runAutomationForUser(userData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor: ' + error.message 
        });
    }
});

// Ejecutar automatización para todos los usuarios
app.post('/api/run-all-automation', async (req, res) => {
    try {
        const users = loadUsers();
        console.log(`📨 Procesando ${users.length} usuarios en paralelo`);
        
        const results = await runAutomationInParallel(users);
        
        res.json({ 
            success: true, 
            results: results.map((result, index) => ({
                user: users[index],
                result: result
            }))
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor: ' + error.message 
        });
    }
});

// Ruta principal - servir el HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
});