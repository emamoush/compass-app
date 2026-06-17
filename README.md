# Compass — Sistema de Gestión Integral

App de administración interna para gestión de tesorería, clientes, proveedores y balance financiero.

## Stack
- **Frontend:** HTML + CSS + JavaScript (ES Modules, sin frameworks)
- **Base de datos:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Repositorio:** GitHub

---

## Configuración inicial

### 1. Base de datos en Supabase
1. Entrá a [supabase.com](https://supabase.com) y abrí tu proyecto `compass`
2. Ir a **SQL Editor → New query**
3. Pegá el contenido completo de `supabase_schema.sql` y ejecutalo con **Run**
4. Verificá que se crearon las tablas en **Table Editor**

### 2. Crear el primer usuario (Admin)
1. En Supabase → **Authentication → Users → Invite user**
2. Ingresá el email del administrador
3. Luego en **SQL Editor** ejecutá:
```sql
UPDATE profiles SET role = 'admin', full_name = 'Tu Nombre' WHERE id = 'UUID_DEL_USUARIO';
```
(El UUID lo encontrás en Authentication → Users)

### 3. Deploy en Vercel
1. Subí esta carpeta a un repositorio en GitHub
2. En [vercel.com](https://vercel.com) → **New Project → Import** tu repositorio
3. Framework Preset: **Other**
4. Click en **Deploy**
5. Vercel te dará una URL pública automáticamente

---

## Roles del sistema
| Rol | Permisos |
|-----|----------|
| **admin** | Acceso total: ver, cargar, editar, eliminar, gestionar usuarios |
| **operator** | Cargar y editar datos. No puede gestionar usuarios |
| **reader** | Solo lectura. Ideal para el estudio contable |

---

## Módulos
- **Dashboard** — Métricas globales y resumen del estado actual
- **Tesorería** — Conciliación bancaria (CC Común, Especial, Dólares, Tarjetas, Extractos)
- **Clientes** — Facturas, estado de cuenta, base de clientes
- **Proveedores** — Facturas a pagar, botón "Abonado", base de proveedores
- **EGRs** — Egresos a prestadores sin factura
- **Balance** — Resumen mensual y anual con exportación
- **Aportes de Socios** — Registro de aportes de capital (solo admin/operator)
- **Usuarios** — Gestión de accesos y roles (solo admin)

---

## Exportación
Todos los módulos permiten exportar en **Excel (.xlsx)** y **PDF** directamente desde el navegador.

---

## Notas importantes
- Los datos se almacenan en Supabase (PostgreSQL en la nube)
- El plan gratuito de Supabase pausa proyectos sin actividad por 7 días. Se reactiva automáticamente al ingresar
- Para agregar nuevos usuarios: Módulo Usuarios → Crear usuario (solo admin)
- Los extractos bancarios (PDF) se gestionan en el módulo Tesorería → Extractos
