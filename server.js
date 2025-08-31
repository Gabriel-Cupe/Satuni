const express = require('express');
const puppeteer = require('puppeteer-core');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const compression = require('compression');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.static('public'));

// Configuración
const PASSWORD = "123Jandy!";
const SUPABASE_URL = "https://appfjlajubbjqlfkhywx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcGZqbGFqdWJianFsZmtoeXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTIzMTgsImV4cCI6MjA3MjIyODMxOH0.eqzN8_4U5yz3nTi4sbS_3qDE_79-FLXNA1I8Oyue_SE";

// Inicializar cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Rutas disponibles
const AVAILABLE_ROUTES = ['Ate', 'Norte', 'Puente Piedra', 'Sur'];

// Cargar usuarios desde Supabase
async function loadUsers() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*');
            
        if (error) {
            console.error("Error loading users from Supabase:", error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error("Exception loading users:", error);
        return [];
    }
}

// Guardar usuario en Supabase
async function saveUser(user) {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([user])
            .select();
            
        if (error) {
            console.error("Error saving user to Supabase:", error);
            return false;
        }
        
        return data && data.length > 0;
    } catch (error) {
        console.error("Exception saving user:", error);
        return false;
    }
}

// Eliminar usuario de Supabase
async function deleteUser(code) {
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('code', code);
            
        if (error) {
            console.error("Error deleting user from Supabase:", error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Exception deleting user:", error);
        return false;
    }
}

// Función para conectar con Browserless o Chrome local
async function getBrowser() {
  try {
    // Para producción, usar Browserless
    if (process.env.NODE_ENV === 'production') {
      const browserWSEndpoint = `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`;
      console.log('Conectando a Browserless:', browserWSEndpoint);
      return await puppeteer.connect({
        browserWSEndpoint,
        defaultViewport: { width: 1280, height: 720 }
      });
    } else {
      // Para desarrollo local
      return await puppeteer.launch({
        headless: false,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
      });
    }
  } catch (error) {
    console.error('Error connecting to browser:', error);
    throw error;
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

// Función principal de automatización para un usuario
async function runAutomationForUser(userData) {
    let browser = null;
    let page = null;
    const maxIntentos = 5;
    let intentos = 0;
    let exito = false;
    let resultadoFinal = null;

    try {
        console.log(`🚀 Iniciando navegador para: ${userData.name}`);
        
        browser = await getBrowser();
        page = await browser.newPage();
        
        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(30000);
        
        console.log(`⏳ Navegando a arruni.org para: ${userData.name}`);
        await page.goto('https://arruni.org', { waitUntil: 'networkidle2' });

        while (intentos < maxIntentos && !exito) {
            intentos++;
            console.log(`\n🎯 INTENTO ${intentos} de ${maxIntentos} para: ${userData.name}`);
            
            try {
                await page.waitForSelector('#name', { timeout: 30000 });
                
                await page.type('#name', userData.name);
                await page.type('#last_name', userData.last_name);
                await page.type('#code', userData.code);
                await page.type('#phone', userData.phone);
                
                await page.select('#faculty', userData.faculty);
                
                try {
                    await page.waitForSelector('.route-option', { timeout: 10000 });
                } catch (error) {
                    console.log("❌ No se cargaron las rutas, recargando...");
                    await recargarPagina(page);
                    continue;
                }
                
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
                
                let clicExitoso = false;
                
                try {
                    const submitButton = await page.$('button[type="submit"]');
                    if (submitButton) {
                        await submitButton.click();
                        clicExitoso = true;
                    } else {
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
                
                try {
                    await page.waitForSelector('.fixed.inset-0, .bg-red-50, .bg-green-50', { timeout: 10000 });
                } catch (error) {
                    console.log("❌ No se detectó respuesta después de registrar, recargando...");
                    await recargarPagina(page);
                    continue;
                }
                
                const ticketElement = await page.$('.fixed.inset-0');
                if (ticketElement) {
                    console.log(`🎉 Ticket de reserva detectado para: ${userData.name}`);
                    
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
                
                console.log("❌ No se detectó resultado claro, recargando...");
                await recargarPagina(page);
                
            } catch (error) {
                console.error(`💥 Error en intento ${intentos} para ${userData.name}:`, error);
                await recargarPagina(page);
            }
        }
        
    } catch (error) {
        console.error(`💥 Error general para ${userData.name}:`, error);
        resultadoFinal = { 
            success: false, 
            message: `Error: ${error.message}`,
            intentos: intentos
        };
    } finally {
        if (page) await page.close();
        if (browser) {
            if (process.env.NODE_ENV === 'production') {
                await browser.disconnect();
            } else {
                await browser.close();
            }
        }
    }
    
    if (!exito && !resultadoFinal) {
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
    const maxParallel = process.env.NODE_ENV === 'production' ? 2 : users.length;
    const results = [];
    
    for (let i = 0; i < users.length; i += maxParallel) {
        const chunk = users.slice(i, i + maxParallel);
        const promises = chunk.map(user => runAutomationForUser(user));
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
        
        if (i + maxParallel < users.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return results;
}

// ================== RUTAS DE LA API ==================

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
app.get('/api/users', async (req, res) => {
    try {
        const users = await loadUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al cargar usuarios' });
    }
});

// Obtener rutas disponibles
app.get('/api/routes', (req, res) => {
    res.json(AVAILABLE_ROUTES);
});

// Agregar usuario
app.post('/api/users', async (req, res) => {
    try {
        const newUser = req.body;
        const users = await loadUsers();
        
        if (users.some(user => user.code === newUser.code)) {
            return res.status(400).json({ success: false, message: 'El usuario ya existe' });
        }
        
        if (await saveUser(newUser)) {
            res.json({ success: true, user: newUser });
        } else {
            res.status(500).json({ success: false, message: 'Error al guardar usuario' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Eliminar usuario
app.delete('/api/users/:code', async (req, res) => {
    try {
        const userCode = req.params.code;
        
        if (await deleteUser(userCode)) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
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
        const users = await loadUsers();
        console.log(`📨 Procesando ${users.length} usuarios`);
        
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

// ================== RUTAS PRINCIPALES ==================

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir archivos estáticos
app.use(express.static('public'));

// Manejo de rutas para SPA - DEBE IR AL FINAL
app.get('*', (req, res) => {
    // Excluir rutas de API y archivos con extensiones
    if (req.path.startsWith('/api/') || /\.[a-zA-Z0-9]+$/.test(req.path)) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
    console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
});